import { redirect } from "next/navigation";

export default function OldSignupRedirect() {
  redirect("/signup");
}
