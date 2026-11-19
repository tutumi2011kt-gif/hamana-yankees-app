// Candidate only: do not import from deployed parent.html until production release is authorized.
// Requires tested Firestore anonymous-answer rules, reviewed January publication and rollback plan.
export const ANSWER_PUBLICATION_MODE='instant';
export const PARENT_WRITES_ENABLED=true;
export const ACCOUNT_REQUIRED=false;
export const REGISTRATION_REQUIRED=false;
