import api, { errMsg } from "./client";

// Helper to unwrap response data and extract API field errors
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