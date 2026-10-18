const Requisition = require("../models/Requisition");
const Notification = require("../models/Notification");

const SERVER_ERROR = { message: "Something went wrong. Please try again." };

// YYYY-MM-DD in Philippine time (toISOString would use UTC and show the wrong day)
const fmtDate = (d) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });

// Shapes a DB document into what the React pages expect
const toClient = (r) => {
  const parts = [
    ...r.itemsList.map((i) => `${i.name} (${i.qty})`),
    ...r.purchaseItems.map((i) => `${i.name} (${i.qty})`),
  ];

  // Only present when the requester was populated (staff views)
  const requester =
    r.requester && r.requester.firstName
      ? {
          name: [r.requester.firstName, r.requester.lastName].filter((n) => n && n !== "-").join(" "),
          email: r.requester.email,
          idNumber: r.requester.idNumber || null,
        }
      : undefined;

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
    requester,
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
  try {
    const docs = await Requisition.find({ requester: req.user._id }).sort({ createdAt: -1 });
    res.json({ requisitions: docs.map(toClient) });
  } catch (err) {
    console.error("list requisitions error:", err);
    res.status(500).json(SERVER_ERROR);
  }
};

/** GET /api/requisitions/all: every slip (Moderator / Administrator only) */
exports.listAll = async (req, res) => {
  try {
    const docs = await Requisition.find()
      .sort({ createdAt: -1 })
      .populate("requester", "firstName lastName email idNumber");
    res.json({ requisitions: docs.map(toClient) });
  } catch (err) {
    console.error("listAll requisitions error:", err);
    res.status(500).json(SERVER_ERROR);
  }
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
    res.status(500).json(SERVER_ERROR);
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
    res.status(500).json(SERVER_ERROR);
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
    res.status(500).json(SERVER_ERROR);
  }
};

// What the student is told for each status change
const STATUS_NOTIF = {
  Processing: { type: "info", text: "is now being processed." },
  Purchasing: { type: "info", text: "has been forwarded for purchasing." },
  Accepted: { type: "success", text: "has been approved. Please proceed to the Property Window for pickup." },
  Denied: { type: "warning", text: "was denied." },
};

/** PATCH /api/requisitions/:slip/status (Moderator / Administrator only) */
exports.setStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const remarks = String(req.body.remarks || "").trim();

    if (!STATUS_NOTIF[status]) {
      return res.status(400).json({ message: "Invalid status." });
    }

    const doc = await Requisition.findOne({ slipNumber: req.params.slip });
    if (!doc) return res.status(404).json({ message: "Requisition not found." });

    doc.status = status;
    doc.remarks = remarks;
    if (status === "Accepted" || status === "Denied") doc.processedAt = new Date();
    await doc.save();

    const n = STATUS_NOTIF[status];
    await Notification.create({
      user: doc.requester,
      title: `Requisition ${status}`,
      message: `Your requisition slip ${doc.slipNumber} ${n.text}${remarks ? ` Remarks: ${remarks}` : ""}`,
      type: n.type,
      link: "/user/requests",
    });

    res.json({ requisition: toClient(doc) });
  } catch (err) {
    console.error("setStatus error:", err);
    res.status(500).json(SERVER_ERROR);
  }
};