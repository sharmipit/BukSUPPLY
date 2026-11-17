require('dotenv').config();
const { google } = require('googleapis');

(async () => {
  const credentials = JSON.parse(Buffer.from(process.env.GFORMS_CREDENTIALS_B64, 'base64').toString());
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/forms.body.readonly'],
  });
  const forms = google.forms({ version: 'v1', auth });
  const { data } = await forms.forms.get({ formId: process.env.GFORMS_FORM_ID });
  for (const item of data.items) {
    console.log(item.title, '→', item.questionItem?.question?.questionId);
  }
})();