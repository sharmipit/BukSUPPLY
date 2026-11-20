// Lists the questions of the feedback Google Form with their IDs.
// Usage, from the backend folder:  node scripts/formQuestions.js
// Reads the Form ID and service account key from System Settings > Google Forms feedback
// (or from the GFORMS_* values in .env until they are saved there).
require('dotenv').config();
const { google } = require('googleapis');
const settings = require('../services/settings');

(async () => {
  const s = settings.get();
  const credentials = settings.parseServiceAccount(s.formsCredentials);
  if (!s.formsFormId || !credentials) {
    return console.log(
      'Add the Form ID and service account key under System Settings > Google Forms feedback first.'
    );
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/forms.body.readonly'],
  });
  const forms = google.forms({ version: 'v1', auth });
  const { data } = await forms.forms.get({ formId: s.formsFormId });
  for (const item of data.items) {
    console.log(item.title, '→', item.questionItem?.question?.questionId);
  }
})();