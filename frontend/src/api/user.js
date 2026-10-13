import api, { errMsg } from "./client";

// Wraps the shared client so Profile.jsx keeps working as written:
// resolves with the response data, and throws an Error with .fieldErrors
async function call(promise) {
  try {
    const { data } = await promise;
    return data;
  } catch (err) {
    const e = new Error(errMsg(err));
    e.fieldErrors = err.response?.data?.errors;
    throw e;
  }
}

export const fetchProfile = () => call(api.get("/user/profile"));

export const saveProfile = (body) => call(api.put("/user/profile", body));

export const deactivateAccount = () => call(api.put("/user/deactivate"));