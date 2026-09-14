import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="flex min-h-full w-full items-center justify-center py-16">
      <SignUp />
    </div>
  );
}
