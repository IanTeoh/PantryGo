import { Redirect } from "expo-router";

// Where Google sign-in sends you back to (pantrygo://auth-callback). The sign-in
// itself is picked up in AuthContext; this screen just makes sure that if the phone
// opens the link as a page, you land in the app instead of on "page not found".
export default function AuthCallback() {
  return <Redirect href="/" />;
}
