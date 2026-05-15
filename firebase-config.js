import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import { getDatabase }   from "https://www.gstatic.com/firebasejs/12.13.0/firebase-database.js";

const firebaseConfig = {
  apiKey:            "AIzaSyDSRrnuG77-QgjBDNGDy9Ch2sEbUDDJaoA",
  authDomain:        "botc-town-square.firebaseapp.com",
  databaseURL:       "https://botc-town-square-default-rtdb.firebaseio.com",
  projectId:         "botc-town-square",
  storageBucket:     "botc-town-square.firebasestorage.app",
  messagingSenderId: "1021461143416",
  appId:             "1:1021461143416:web:c54a152a0d5c4f7929f28d",
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
