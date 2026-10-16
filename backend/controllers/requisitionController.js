const Requisition = require("../models/Requisition");
const Notification = require("../models/Notification");

const fmtDate = (d) => d.toISOString().split("T")[0];

// Shapes a DB document into what React pages already expect
const toClient = (r) => {
  const parts = [
    ...r.itemsList.map((i) => `${i.name} (${i.qty})`),
    ...r.purchaseItems.map((i) => `${i.name} (${i.qty})`),
  ];
  return {
    id: r.slipNumber,
    department: r.department,
    title: r.title,
    purpose: r.purpose,
    item: parts.join(", "),
    date: fmtDate(r.createdAt),
    dateFiled: fmtDate(r.createdAt),
    dateProcessed: r.processedAt ? fmtDate(r.processedAt) : "Pending",
    status: r.status,
    remarks: r.remarks || (r.status === "Pending" ? "Awaiting moderator review." : ""),
    itemsList: r.itemsList,
    purchaseItems: r.purchaseItems,
  };
};

const cleanItems = (arr) =>
  (Array.isArray(arr) ? arr : [])
    .filter((i) => i && typeof i.name === "string" && i.name.trim())
    .map((i) => ({
      name: i.name.trim(),
      qty: Math.floor(Number(i.qty)),
      reason: String(i.reason || "").trim(),
      maxNormal: Number(i.maxNormal) || undefined,
    }));

// Validates and returns the editable fields (never status/id/date)
const parseBody = (body) => {
  const title = String(body.title || "").trim();
  const purpose = String(body.purpose || "").trim();
  const itemsList = cleanItems(body.itemsList);
  const purchaseItems = cleanItems(body.purchaseItems);

  if (!title || !purpose) return { error: "Title and purpose are required." };
  if (!itemsList.length && !purchaseItems.length) return { error: "Add at least one item." };
  if ([...itemsList, ...purchaseItems].some((i) => !(i.qty >= 1))) {
    return { error: "Every item needs a quantity of at least 1." };
  }
  return {
    data: { title, purpose, itemsList, purchaseItems, department: String(body.department || "").trim() },
  };
};

/** GET /api/requisitions: the logged-in user's own slips */
exports.list = async (req, res) => {
  const docs = await Requisition.find({ requester: req.user._id }).sort({ createdAt: -1 });
  res.json({ requisitions: docs.map(toClient) });
};

/** POST /api/requisitions */
exports.create = async (req, res) => {
  try {
    const { data, error } = parseBody(req.body);
    if (error) return res.status(400).json({ message: error });

    const doc = await Requisition.create({
      ...data,
      requester: req.user._id,
      slipNumber: await Requisition.nextSlipNumber(),
      status: "Pending",
    });

    await Notification.create({
      user: req.user._id,
      title: "New Status Update: Pending",
      message: `Your requisition slip ${doc.slipNumber} has been submitted and is awaiting moderator review.`,
      type: "info",
      link: "/user/requests",
    });

    res.status(201).json({ requisition: toClient(doc) });
  } catch (err) {
    console.error("create requisition error:", err);
    res.status(500).json({ message: "Something went wrong. Please try again." });
  }
};

/** PUT /api/requisitions/:slip: owner only, Pending only */
exports.update = async (req, res) => {
  try {
    const doc = await Requisition.findOne({ slipNumber: req.params.slip, requester: req.user._id });
    if (!doc) return res.status(404).json({ message: "Requisition not found." });
    if (doc.status !== "Pending") {
      return res.status(409).json({ message: "Only pending requisitions can be edited." });
    }

    const { data, error } = parseBody(req.body);
    if (error) return res.status(400).json({ message: error });

    Object.assign(doc, data);
    await doc.save();
    res.json({ requisition: toClient(doc) });
  } catch (err) {
    console.error("update requisition error:", err);
    res.status(500).json({ message: "Something went wrong. Please try again." });
  }
};

/** DELETE /api/requisitions/:slip: owner only, Pending only */
exports.remove = async (req, res) => {
  try {
    const doc = await Requisition.findOne({ slipNumber: req.params.slip, requester: req.user._id });
    if (!doc) return res.status(404).json({ message: "Requisition not found." });
    if (doc.status !== "Pending") {
      return res.status(409).json({ message: "Only pending requisitions can be deleted." });
    }
    await doc.deleteOne();
    res.json({ message: "Requisition deleted." });
  } catch (err) {
    console.error("delete requisition error:", err);
    res.status(500).json({ message: "Something went wrong. Please try again." });
  }
};