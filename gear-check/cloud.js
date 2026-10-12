// Firebase web client config is public; access is restricted by Firestore Rules.
import {initializeApp} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import {getFirestore,doc,onSnapshot,setDoc,serverTimestamp} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import {getAuth,GoogleAuthProvider,signInWithPopup,signOut,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';

const config={
  apiKey:"AIzaSyDKvNaIpTms7fM53jIM7vg4Dem0GTsA7D0",
  authDomain:"hamana-yankees-gear-check.firebaseapp.com",
  projectId:"hamana-yankees-gear-check",
  storageBucket:"hamana-yankees-gear-check.firebasestorage.app",
  messagingSenderId:"74805460509",
  appId:"1:74805460509:web:757a635056fb8f42e850f4"
};
const firebase=initializeApp(config);
const auth=getAuth(firebase);
const docRef=doc(getFirestore(firebase),'gearCheck','config');

export function connect({onData,onStatus,onUser}){
  onAuthStateChanged(auth,user=>onUser(user?{uid:user.uid}:null),()=>onUser(null));
  onSnapshot(docRef,snapshot=>{
    if(snapshot.exists()){onData(snapshot.data());onStatus('ready')}
    else onStatus('empty');
  },err=>onStatus(err.code==='permission-denied'?'locked':'offline'));
  return {
    login:()=>signInWithPopup(auth,new GoogleAuthProvider()),
    logout:()=>signOut(auth),
    save:data=>setDoc(docRef,{modes:data.modes,profiles:data.profiles,
      notes:data.notes,revision:String(data.revision),updatedAt:serverTimestamp()})
  };
}
