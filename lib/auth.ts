// ============================================================
// COMPUNIL — Firebase Auth Helpers  (v2 — production-stable)
// ============================================================

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth'
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from './firebase'
import type { UserRole } from '../types'

const googleProvider = new GoogleAuthProvider()

// ── Admin cookie (enables server-side middleware check) ──────
const ADMIN_COOKIE = '__compunil_admin'

function setAdminCookie(isAdmin: boolean) {
  if (typeof document === 'undefined') return
  if (isAdmin) {
    document.cookie = `${ADMIN_COOKIE}=granted; path=/; SameSite=Strict; max-age=86400`
  } else {
    document.cookie = `${ADMIN_COOKIE}=; path=/; max-age=0`
  }
}

// ── Register ─────────────────────────────────────────────────
export async function registerWithEmail(
  email: string,
  password: string,
  name: string,
): Promise<FirebaseUser> {
  if (!auth) throw new Error('[Compunil] Firebase Auth not initialized.')
  const cred = await createUserWithEmailAndPassword(auth, email, password)
  await updateProfile(cred.user, { displayName: name })

  await setDoc(doc(db, 'users', cred.user.uid), {
    id:        cred.user.uid,
    name,
    email,
    role:      'user' as UserRole,
    createdAt: serverTimestamp(),
  })

  return cred.user
}

// ── Login ────────────────────────────────────────────────────
export async function loginWithEmail(
  email: string,
  password: string,
): Promise<FirebaseUser> {
  if (!auth) throw new Error('[Compunil] Firebase Auth not initialized.')
  const cred = await signInWithEmailAndPassword(auth, email, password)
  return cred.user
}

// ── Google Login ─────────────────────────────────────────────
export async function loginWithGoogle(): Promise<FirebaseUser> {
  if (!auth) throw new Error('[Compunil] Firebase Auth not initialized.')
  const cred = await signInWithPopup(auth, googleProvider)
  const user  = cred.user

  const userRef  = doc(db, 'users', user.uid)
  const userSnap = await getDoc(userRef)
  if (!userSnap.exists()) {
    await setDoc(userRef, {
      id:        user.uid,
      name:      user.displayName ?? 'User',
      email:     user.email,
      role:      'user' as UserRole,
      photoURL:  user.photoURL,
      createdAt: serverTimestamp(),
    })
  }

  return user
}

// ── Sign Out ─────────────────────────────────────────────────
export async function signOut(): Promise<void> {
  setAdminCookie(false)
  if (!auth) return
  await firebaseSignOut(auth)
}

// ── Password Reset ───────────────────────────────────────────
export async function resetPassword(email: string): Promise<void> {
  if (!auth) throw new Error('[Compunil] Firebase Auth not initialized.')
  await sendPasswordResetEmail(auth, email)
}

// ── Get User Role ─────────────────────────────────────────────
export async function getUserRole(uid: string): Promise<UserRole> {
  try {
    const snap = await getDoc(doc(db, 'users', uid))
    const role = snap.data()?.role
    return role === 'admin' ? 'admin' : 'user'
  } catch {
    return 'user'
  }
}

// ── Sync admin cookie after role is known ────────────────────
export function syncAdminCookie(role: UserRole) {
  setAdminCookie(role === 'admin')
}

// ── Auth State Observer ───────────────────────────────────────
export function onAuthChange(cb: (user: FirebaseUser | null) => void) {
  if (!auth) {
    console.warn('[Compunil] Firebase Auth undefined — check .env.local and restart server.')
    cb(null)
    return () => {}
  }
  return onAuthStateChanged(auth, cb)
}
