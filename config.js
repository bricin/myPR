// App-owner configuration. This public ID is shared by all users, not a secret.
// Register a Web OAuth client once; authorize https://bricin.github.io.
// Never put a client secret or access token in this file.
export const GOOGLE_CLIENT_ID = '';
export const googleConfigured = /^[a-zA-Z0-9._-]+\.apps\.googleusercontent\.com$/.test(GOOGLE_CLIENT_ID);
