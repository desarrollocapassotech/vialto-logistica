// firebase.d.ts
declare module "@/firebase" {
  import { Auth, GoogleAuthProvider } from "firebase/auth";
  import { Firestore } from "firebase/firestore";
  import { FirebaseStorage } from "firebase/storage";

  const auth: Auth;
  const googleProvider: GoogleAuthProvider;
  const db: Firestore;
  const storage: FirebaseStorage;

  export { auth, googleProvider, db, storage };
}