import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
  getDatabase, ref, push, onValue, serverTimestamp, get, child, set, update, remove, query, limitToLast
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyAyR3YYB0BP9wNOsBc7Kcs57KbJcbTpRTo",
  authDomain: "thenewdiscisdead.firebaseapp.com",
  projectId: "thenewdiscisdead",
  storageBucket: "thenewdiscisdead.firebasestorage.app",
  messagingSenderId: "1031346102402",
  appId: "1:1031346102402:web:7fae429231e82fa78d149b",
  measurementId: "G-Q1K6WTG06F"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app); 
const dbRef = ref(db);

const DEFAULT_PFP = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23999'%3E%3Cpath d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z'/%3E%3C/svg%3E";
const MAX_FILE_SIZE = 5 * 1024 * 1024;

const authScreen = document.getElementById('auth-screen');
const chatScreen = document.getElementById('chat-screen');
const blockedScreen = document.getElementById('blocked-screen');
const usernameInput = document.getElementById('username'); 
const passwordInput = document.getElementById('password');
const authError = document.getElementById('auth-error');
const currentPfpImg = document.getElementById('current-pfp');
const currentUserSpan = document.getElementById('current-user');
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const messagesContainer = document.getElementById('messages-container');
const fileUpload = document.getElementById('file-upload');
const filePreview = document.getElementById('file-preview');
const filePreviewName = document.getElementById('file-preview-name');
const chatError = document.getElementById('chat-error');
const typingIndicator = document.getElementById('typing-indicator');

const dmSearchInput = document.getElementById('dm-search-input');
const dmSearchResults = document.getElementById('dm-search-results');
const dmChannelsList = document.getElementById('dm-channels-list');
const openAdminBtn = document.getElementById('open-admin-btn');
const adminModal = document.getElementById('admin-modal');
const closeAdminBtn = document.getElementById('close-admin-btn');
const openBlockReqBtn = document.getElementById('open-block-req-btn');
const reqBadge = document.getElementById('req-badge');
const blockReqModal = document.getElementById('block-req-modal');
const closeReqBtn = document.getElementById('close-req-btn');
const blockRequestsList = document.getElementById('block-requests-list');

const announceText = document.getElementById('announce-text');
const announceDuration = document.getElementById('announce-duration');
const sendAnnounceBtn = document.getElementById('send-announce-btn');
const announcementBanner = document.getElementById('announcement-banner');
const announcementTextDisplay = document.getElementById('announcement-text');
const dmBlockToggleBtn = document.getElementById('dm-block-toggle-btn');
const replyBanner = document.getElementById('reply-banner');
const replyToName = document.getElementById('reply-to-name');
const replyToText = document.getElementById('reply-to-text');
const cancelReplyBtn = document.getElementById('cancel-reply-btn');
const mainInputContainer = document.getElementById('main-input-container');

// User Management tools
const manageUserSearch = document.getElementById('manage-user-search');
const manageUserResults = document.getElementById('manage-user-results');
const manageUserActions = document.getElementById('manage-user-actions');
const manageTargetDisplay = document.getElementById('manage-target-display');
const grantStaffBtn = document.getElementById('grant-staff-btn');
const grantHelperBtn = document.getElementById('grant-helper-btn');
const quickUnblockBtn = document.getElementById('quick-unblock-btn');

let unsubscribeMessages = null, unsubscribeTyping = null, unsubscribeUser = null, unsubscribeBlockStatus = null, unsubscribeBlockReqs = null;
let currentActiveUser = null;
let currentUserData = {};
let currentChannel = "main";
let currentChannelType = "text"; 
let currentDMTarget = null;
let isCurrentDMBlocked = false;
let adminTargetUser = null;
let adminTargetUserData = null;
let manageTargetUser = null;
let announceTimeout = null;
let attachedFileData = null;
let currentReplyContext = null;
let editingMessageId = null;
let typingTimeout = null;
let lastMessageTime = 0;

if ("Notification" in window && Notification.permission !== "granted") Notification.requestPermission();
function showDesktopNotification(title, body) {
  if ("Notification" in window && Notification.permission === "granted") new Notification(title, { body, icon: currentUserData.pfp || DEFAULT_PFP });
}

const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => resolve(reader.result);
  reader.onerror = (error) => reject(error);
});

async function logUserIn(username) {
  currentActiveUser = username;
  
  if (unsubscribeBlockStatus) unsubscribeBlockStatus();
  unsubscribeBlockStatus = onValue(ref(db, `blocked_users/${username}`), (snap) => {
    if (snap.exists() && snap.val() === true) {
      authScreen.classList.add('hidden'); chatScreen.classList.add('hidden'); blockedScreen.classList.remove('hidden');
    } else {
      blockedScreen.classList.add('hidden');
      if (currentActiveUser) { authScreen.classList.add('hidden'); chatScreen.classList.remove('hidden'); }
    }
  });

  if (unsubscribeUser) unsubscribeUser();
  unsubscribeUser = onValue(ref(db, `users/${username}`), (snap) => {
    if (snap.exists() && snap.val().wipedTo) {
      const newUsername = snap.val().wipedTo;
      localStorage.setItem('obh_session', newUsername);
      alert(`Your account has been wiped by staff. Your new username is @${newUsername}`);
      logUserIn(newUsername);
    } else if (!snap.exists() && currentActiveUser === username) {
      alert("Your account state has changed. Please log in again.");
      document.getElementById('logout-btn').click();
    } else if (snap.exists()) {
      currentUserData = snap.val();
      if(!currentUserData.pfp) currentUserData.pfp = DEFAULT_PFP;
      updateUIAfterLogin(username);
    }
  });

  loadUserDMs();
  switchChannel('main', 'text');
}

function updateUIAfterLogin(username) {
  currentPfpImg.src = currentUserData.pfp || DEFAULT_PFP;
  let badges = (username === 'thecoolwebsitemaker') ? ' <span class="dev-badge" title="Web Developer">💻</span>' : '';
  if (currentUserData.isStaff) badges += ' <span class="staff-badge" title="Staff">🛡️</span>';
  if (currentUserData.isHelper) badges += ' <span class="helper-badge" title="Helper">🛠</span>';
  currentUserSpan.innerHTML = (currentUserData.displayName || username) + badges;
  
  const isOwner = username === 'thecoolwebsitemaker';
  const isStaff = currentUserData.isStaff;
  
  if (isStaff || isOwner) {
    openAdminBtn.classList.remove('hidden');
    openBlockReqBtn.classList.remove('hidden');
    listenToBlockRequests();
  } else {
    openAdminBtn.classList.add('hidden');
    openBlockReqBtn.classList.add('hidden');
    if(unsubscribeBlockReqs) { unsubscribeBlockReqs(); unsubscribeBlockReqs = null; }
  }

  if (isOwner) {
    document.getElementById('owner-tools').classList.remove('hidden');
    document.getElementById('admin-revoke-btn').classList.remove('hidden');
  } else {
    document.getElementById('owner-tools').classList.add('hidden');
    document.getElementById('admin-revoke-btn').classList.add('hidden');
  }
}

const savedSession = localStorage.getItem('obh_session');
if (savedSession) logUserIn(savedSession);

document.getElementById('login-btn').addEventListener('click', async (e) => {
  e.preventDefault();
  authError.textContent = 'Checking...';
  const username = usernameInput.value.trim().toLowerCase();
  const password = passwordInput.value;
  if (!username || !password) return (authError.textContent = "Enter both fields.");
  try {
    const snap = await get(child(dbRef, `users/${username}`));
    if (snap.exists()) {
      if (snap.val().wipedTo) return (authError.textContent = `Account wiped. Try: ${snap.val().wipedTo}`);
      if (snap.val().password === password) {
        localStorage.setItem('obh_session', username); authError.textContent = ''; logUserIn(username);
        return;
      }
    }
    authError.textContent = "Incorrect username or password.";
  } catch (error) { authError.textContent = "Database error."; }
});

document.getElementById('signup-btn').addEventListener('click', async (e) => {
  e.preventDefault();
  const username = usernameInput.value.trim().toLowerCase();
  const password = passwordInput.value;
  const ageGroup = document.getElementById('age-group');
  if (ageGroup.classList.contains('hidden')) {
    if (username.length < 3 || username.length > 16) return (authError.textContent = "Username 3-16 chars.");
    if (password.length < 4) return (authError.textContent = "Password 4+ chars.");
    authError.textContent = "Checking username...";
    try {
      const snapshot = await get(child(dbRef, `users/${username}`));
      if (snapshot.exists()) return (authError.textContent = "Username taken.");
      authError.textContent = "";
      document.getElementById('login-fields').classList.add('hidden');
      document.getElementById('login-btn').classList.add('hidden');
      ageGroup.classList.remove('hidden');
      document.getElementById('signup-btn').textContent = "Complete Account";
    } catch (e) { authError.textContent = "Database error."; }
  } else {
    authError.textContent = "Creating account...";
    const age = document.getElementById('age-select').value;
    try {
      await set(ref(db, `users/${username}`), { password, pfp: DEFAULT_PFP, age, isStaff: false, isHelper: false, displayName: "", bio: "", createdAt: serverTimestamp() });
      localStorage.setItem('obh_session', username);
      authError.textContent = ''; logUserIn(username);
      document.getElementById('login-fields').classList.remove('hidden');
      document.getElementById('login-btn').classList.remove('hidden');
      ageGroup.classList.add('hidden');
      document.getElementById('signup-btn').textContent = "Create Account";
    } catch (error) { authError.textContent = "Database error."; }
  }
});

document.getElementById('logout-btn').addEventListener('click', () => {
  localStorage.removeItem('obh_session'); currentActiveUser = null; currentUserData = {};
  authScreen.classList.remove('hidden'); chatScreen.classList.add('hidden'); blockedScreen.classList.add('hidden');
  [unsubscribeMessages, unsubscribeTyping, unsubscribeUser, unsubscribeBlockStatus, unsubscribeBlockReqs].forEach(u => u && u());
});

document.getElementById('edit-profile-btn').addEventListener('click', () => {
  document.getElementById('display-name-input').value = currentUserData?.displayName || "";
  document.getElementById('bio-input').value = currentUserData?.bio || "";
  document.getElementById('profile-modal').classList.remove('hidden');
});
document.getElementById('cancel-profile-btn').addEventListener('click', () => document.getElementById('profile-modal').classList.add('hidden'));
document.getElementById('save-profile-btn').addEventListener('click', async () => {
  const newDisplayName = document.getElementById('display-name-input').value.trim();
  const newBio = document.getElementById('bio-input').value.trim();
  if (newDisplayName.length > 16 || newBio.length > 750) return alert("Exceeds character limits.");
  try { await update(ref(db, `users/${currentActiveUser}`), { displayName: newDisplayName, bio: newBio }); document.getElementById('profile-modal').classList.add('hidden'); } 
  catch(err) { alert("Failed to save profile."); }
});
document.getElementById('pfp-upload').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file || !currentActiveUser) return;
  if (file.size > MAX_FILE_SIZE) return alert("PFP must be under 5MB.");
  const base64 = await fileToBase64(file);
  await update(ref(db, `users/${currentActiveUser}`), { pfp: base64 });
});

openAdminBtn.addEventListener('click', async () => {
  adminModal.classList.remove('hidden');
  const staffSelect = document.getElementById('staff-roster-select');
  staffSelect.innerHTML = '<option value="">-- View Current Staff --</option>';
  const snap = await get(child(dbRef, 'users'));
  snap.forEach(user => {
    if((user.val().isStaff || user.val().isHelper) && !user.val().wipedTo) {
      let role = user.val().isStaff ? 'Staff' : 'Helper';
      staffSelect.innerHTML += `<option value="${user.key}">[${role}] @${user.key} ${user.val().displayName ? `(${user.val().displayName})` : ''}</option>`;
    }
  });
});
closeAdminBtn.addEventListener('click', () => adminModal.classList.add('hidden'));

sendAnnounceBtn.addEventListener('click', async () => {
  const text = announceText.value.trim(); const dur = parseInt(announceDuration.value);
  if(!text) return;
  await set(ref(db, 'global_events/announcement'), { text, expiresAt: Date.now() + (dur * 1000) }); announceText.value = '';
});

onValue(ref(db, 'global_events/announcement'), (snap) => {
  if(!snap.exists()) return;
  const data = snap.val();
  if(Date.now() < data.expiresAt) {
    announcementTextDisplay.textContent = data.text; announcementBanner.classList.remove('hidden');
    clearTimeout(announceTimeout); announceTimeout = setTimeout(() => announcementBanner.classList.add('hidden'), data.expiresAt - Date.now());
  }
});

document.getElementById('admin-search-btn').addEventListener('click', async () => {
  const search = document.getElementById('admin-user-search').value.trim().toLowerCase();
  const snap = await get(child(dbRef, `users/${search}`));
  if(snap.exists() && !snap.val().wipedTo) {
    adminTargetUser = search; adminTargetUserData = snap.val();
    document.getElementById('target-user-display').textContent = `Target: @${search}`;
    document.getElementById('admin-user-actions').classList.remove('hidden');
  } else {
    alert("User not found."); document.getElementById('admin-user-actions').classList.add('hidden');
  }
});

function canPerformActionOnTarget() {
  if (!adminTargetUser) return false;
  if (adminTargetUser === 'thecoolwebsitemaker' && currentActiveUser !== 'thecoolwebsitemaker') return (alert("Denied: Cannot target site owner."), false);
  if (currentActiveUser !== 'thecoolwebsitemaker' && (adminTargetUser === 'thecoolwebsitemaker' || (adminTargetUserData && adminTargetUserData.isStaff))) return (alert("Denied: Cannot target other staff/owner."), false);
  return true;
}

document.getElementById('admin-mute-btn').addEventListener('click', async () => {
  const mins = parseInt(document.getElementById('mute-duration').value);
  if(!canPerformActionOnTarget() || isNaN(mins)) return;
  await update(ref(db, `users/${adminTargetUser}`), { mutedUntil: Date.now() + (mins * 60000) }); alert(`Muted for ${mins} mins.`);
});
document.getElementById('admin-wipe-btn').addEventListener('click', async () => {
  if(!canPerformActionOnTarget() || !confirm(`Wipe @${adminTargetUser}?`)) return;
  const newUname = 'user_' + Math.random().toString(36).substring(2, 8);
  await set(ref(db, `users/${newUname}`), { ...adminTargetUserData, displayName: "", bio: "", pfp: DEFAULT_PFP, isStaff: false, isHelper: false });
  await set(ref(db, `users/${adminTargetUser}`), { wipedTo: newUname });
  alert(`Account wiped. New: ${newUname}`); document.getElementById('admin-user-actions').classList.add('hidden');
});
document.getElementById('admin-block-btn').addEventListener('click', async () => {
  if(!canPerformActionOnTarget()) return;
  await set(ref(db, `blocked_users/${adminTargetUser}`), true); alert(`Blocked.`);
});
document.getElementById('admin-revoke-btn').addEventListener('click', async () => {
  if(!adminTargetUser || currentActiveUser !== 'thecoolwebsitemaker') return;
  await update(ref(db, `users/${adminTargetUser}`), { isStaff: false, isHelper: false }); alert(`Revoked.`);
});

// Admin User Management Search (Roles / Unblock)
manageUserSearch.addEventListener('input', async (e) => {
  const queryText = e.target.value.trim().toLowerCase();
  if (!queryText) { manageUserResults.classList.add('hidden'); return; }
  try {
    const snap = await get(child(dbRef, 'users'));
    if (!snap.exists()) return;
    manageUserResults.innerHTML = '';
    let matches = 0;
    snap.forEach((uSnap) => {
      const uname = uSnap.key; const udata = uSnap.val();
      if (udata.wipedTo || uname === currentActiveUser) return;
      if (uname.includes(queryText) || (udata.displayName && udata.displayName.toLowerCase().includes(queryText))) {
        matches++;
        const item = document.createElement('div');
        item.classList.add('dm-search-result-item');
        item.innerHTML = `<img src="${udata.pfp || DEFAULT_PFP}" class="dm-result-pfp"><span>@${uname}</span>`;
        item.addEventListener('click', () => {
          manageTargetUser = uname;
          manageTargetDisplay.textContent = `Selected: @${uname}`;
          manageUserResults.classList.add('hidden'); manageUserSearch.value = '';
          manageUserActions.classList.remove('hidden');
        });
        manageUserResults.appendChild(item);
      }
    });
    if(matches > 0) manageUserResults.classList.remove('hidden'); else manageUserResults.classList.add('hidden');
  } catch(err) {}
});

document.addEventListener('click', (e) => { if (!manageUserSearch.contains(e.target) && !manageUserResults.contains(e.target)) manageUserResults.classList.add('hidden'); });

grantStaffBtn.addEventListener('click', async () => {
  if (currentActiveUser !== 'thecoolwebsitemaker') return alert("Access Denied: Owner only.");
  if (!manageTargetUser) return;
  await update(ref(db, `users/${manageTargetUser}`), { isStaff: true, isHelper: false }); 
  alert(`Granted Staff to ${manageTargetUser}`);
});

grantHelperBtn.addEventListener('click', async () => {
  if (currentActiveUser !== 'thecoolwebsitemaker') return alert("Access Denied: Owner only.");
  if (!manageTargetUser) return;
  await update(ref(db, `users/${manageTargetUser}`), { isHelper: true, isStaff: false }); 
  alert(`Granted Helper to ${manageTargetUser}`);
});

quickUnblockBtn.addEventListener('click', async () => {
  if (currentActiveUser !== 'thecoolwebsitemaker') return alert("Access Denied: Owner only.");
  if (!manageTargetUser) return;
  await remove(ref(db, `blocked_users/${manageTargetUser}`)); 
  alert(`Unblocked ${manageTargetUser}`);
});

// Block Requests
function listenToBlockRequests() {
  if(unsubscribeBlockReqs) unsubscribeBlockReqs();
  unsubscribeBlockReqs = onValue(ref(db, 'block_requests'), (snap) => {
    blockRequestsList.innerHTML = '';
    if (!snap.exists()) {
      reqBadge.classList.add('hidden');
      blockRequestsList.innerHTML = '<p>No active requests.</p>';
      return;
    }
    reqBadge.classList.remove('hidden');
    snap.forEach(childSnap => {
      const reqId = childSnap.key; const data = childSnap.val();
      const el = document.createElement('div'); el.classList.add('block-req-item');
      el.innerHTML = `
        <strong>Req By:</strong> @${data.requestedBy} <br>
        <strong>Target:</strong> @${data.target} <br>
        <strong>Reason:</strong> ${data.reason}
        <div class="block-req-actions">
          <button class="primary-btn accept-req" data-id="${reqId}" data-target="${data.target}" style="padding:4px 8px; font-size:12px;">Accept (Block)</button>
          <button class="secondary-btn deny-req" data-id="${reqId}" style="padding:4px 8px; font-size:12px;">Deny</button>
        </div>
      `;
      blockRequestsList.appendChild(el);
    });
  });
}
openBlockReqBtn.addEventListener('click', () => blockReqModal.classList.remove('hidden'));
closeReqBtn.addEventListener('click', () => blockReqModal.classList.add('hidden'));

blockRequestsList.addEventListener('click', async (e) => {
  if(e.target.classList.contains('accept-req')) {
    const id = e.target.dataset.id; const target = e.target.dataset.target;
    await set(ref(db, `blocked_users/${target}`), true);
    await remove(ref(db, `block_requests/${id}`));
    alert(`Blocked @${target} and cleared request.`);
  } else if(e.target.classList.contains('deny-req')) {
    const id = e.target.dataset.id;
    await remove(ref(db, `block_requests/${id}`));
  }
});

dmBlockToggleBtn.addEventListener('click', async () => {
  if(!currentDMTarget) return;
  if(isCurrentDMBlocked) { await remove(ref(db, `user_dms_blocked/${currentActiveUser}/${currentDMTarget}`)); isCurrentDMBlocked = false; } 
  else { await set(ref(db, `user_dms_blocked/${currentActiveUser}/${currentDMTarget}`), true); isCurrentDMBlocked = true; }
  dmBlockToggleBtn.textContent = isCurrentDMBlocked ? "Unblock User" : "Block User";
  dmBlockToggleBtn.className = isCurrentDMBlocked ? "secondary-btn" : "danger-btn";
});
function checkDMBlockStatus(targetUser) {
  onValue(ref(db, `user_dms_blocked/${currentActiveUser}/${targetUser}`), (snap) => {
    isCurrentDMBlocked = (snap.exists() && snap.val() === true);
    dmBlockToggleBtn.textContent = isCurrentDMBlocked ? "Unblock User" : "Block User";
    dmBlockToggleBtn.className = isCurrentDMBlocked ? "secondary-btn" : "danger-btn";
  });
}

// Actions inside chat
messagesContainer.addEventListener('click', async (e) => {
  if (e.target.classList.contains('message-author')) {
    const clickedUser = e.target.dataset.username;
    try {
      const snap = await get(child(dbRef, `users/${clickedUser}`));
      if(snap.exists()) {
        const data = snap.val(); const disp = data.displayName ? ` (${data.displayName})` : '';
        alert(`User: @${clickedUser}${disp}\nAge: ${data.age || 'Not set'}\nBio: ${data.bio || 'No bio written.'}`);
      }
    } catch(err) {}
  }
  
  if (e.target.classList.contains('reply-btn')) {
    currentReplyContext = { username: e.target.dataset.username, displayName: e.target.dataset.displayname, text: e.target.dataset.text };
    replyToName.textContent = currentReplyContext.displayName || currentReplyContext.username;
    replyToText.textContent = currentReplyContext.text || "Attachment";
    replyBanner.classList.remove('hidden'); messageInput.focus();
  }

  if (e.target.classList.contains('edit-btn')) {
    const msgId = e.target.dataset.id; const currentText = e.target.dataset.text;
    const newText = prompt("Edit your message:", currentText);
    if(newText !== null && newText.trim() !== "") {
      const dbPath = currentChannelType === 'text' ? `messages_${currentChannel}/${msgId}` : `messages_dm_${currentChannel}/${msgId}`;
      update(ref(db, dbPath), { text: newText.trim() });
    }
  }

  if (e.target.classList.contains('delete-btn')) {
    if(confirm("Delete this message?")) {
      const msgId = e.target.dataset.id;
      const dbPath = currentChannelType === 'text' ? `messages_${currentChannel}/${msgId}` : `messages_dm_${currentChannel}/${msgId}`;
      remove(ref(db, dbPath));
    }
  }

  if (e.target.classList.contains('admin-block-btn')) {
    const targetUsername = e.target.dataset.username;
    if (targetUsername === 'thecoolwebsitemaker' && currentActiveUser !== 'thecoolwebsitemaker') return alert("Cannot block site owner.");
    if (confirm(`Block ${targetUsername} from the site?`)) await set(ref(db, `blocked_users/${targetUsername}`), true);
  }

  if (e.target.classList.contains('request-block-btn')) {
    const targetUsername = e.target.dataset.username;
    const reason = prompt(`Reason for requesting block on ${targetUsername}?`);
    if(reason) {
      await push(ref(db, 'block_requests'), { target: targetUsername, reason, requestedBy: currentActiveUser, time: serverTimestamp() });
      alert("Block request sent to Admins.");
    }
  }
});

cancelReplyBtn.addEventListener('click', () => { currentReplyContext = null; replyBanner.classList.add('hidden'); });

dmSearchInput.addEventListener('input', async (e) => {
  const queryText = e.target.value.trim().toLowerCase();
  if (!queryText) { dmSearchResults.classList.add('hidden'); dmSearchResults.innerHTML = ''; return; }
  try {
    const snap = await get(child(dbRef, 'users'));
    if (!snap.exists()) return;
    dmSearchResults.innerHTML = ''; let matches = 0;
    snap.forEach((uSnap) => {
      const uname = uSnap.key; const udata = uSnap.val();
      if (udata.wipedTo) return;
      if (uname !== currentActiveUser && (uname.includes(queryText) || (udata.displayName && udata.displayName.toLowerCase().includes(queryText)))) {
        matches++;
        const item = document.createElement('div'); item.classList.add('dm-search-result-item');
        item.innerHTML = `<img src="${udata.pfp || DEFAULT_PFP}" class="dm-result-pfp"><span>@${uname}</span>`;
        item.addEventListener('click', () => { openDMChannel(uname); dmSearchInput.value = ''; dmSearchResults.classList.add('hidden'); });
        dmSearchResults.appendChild(item);
      }
    });
    if (matches > 0) dmSearchResults.classList.remove('hidden'); else dmSearchResults.classList.add('hidden');
  } catch (err) {}
});

function getDMKey(userA, userB) { return [userA, userB].sort().join('_'); }
async function openDMChannel(otherUser) {
  const dmId = getDMKey(currentActiveUser, otherUser);
  await set(ref(db, `user_dms/${currentActiveUser}/${dmId}`), otherUser); switchChannel(dmId, 'dm', otherUser);
}
function loadUserDMs() {
  onValue(ref(db, `user_dms/${currentActiveUser}`), (snapshot) => {
    dmChannelsList.innerHTML = '';
    if (!snapshot.exists()) return;
    snapshot.forEach((childSnap) => {
      const dmId = childSnap.key; const otherUser = childSnap.val();
      const dmEl = document.createElement('div'); dmEl.classList.add('channel', 'dm-channel');
      if (currentChannel === dmId) dmEl.classList.add('active');
      dmEl.innerHTML = `<span>💬 @${otherUser}</span>`;
      dmEl.addEventListener('click', () => switchChannel(dmId, 'dm', otherUser));
      dmChannelsList.appendChild(dmEl);
    });
  });
}

document.querySelectorAll('.channel[data-type="text"]').forEach(el => {
  el.addEventListener('click', () => {
    const targetChannel = el.dataset.channel;
    if(targetChannel === currentChannel) return;
    if(targetChannel === 'staff' && !(currentUserData.isStaff || currentUserData.isHelper || currentActiveUser === 'thecoolwebsitemaker')) {
      return alert("Staff or Helpers only.");
    }
    switchChannel(targetChannel, 'text');
  });
});

function switchChannel(channelName, type, extraData = null) {
  currentChannel = channelName; currentChannelType = type;
  document.querySelectorAll('.channel').forEach(c => c.classList.remove('active'));
  const activeEl = document.querySelector(`.channel[data-channel="${channelName}"]`) || Array.from(document.querySelectorAll('.dm-channel')).find(el => el.dataset.channel === channelName);
  if(activeEl) activeEl.classList.add('active');
  
  if (type === 'text') {
    document.getElementById('current-channel-title').textContent = `# ${channelName}`;
    dmBlockToggleBtn.classList.add('hidden'); currentDMTarget = null;
    
    if(channelName === 'rules' && !(currentUserData.isStaff || currentUserData.isHelper || currentActiveUser === 'thecoolwebsitemaker')) {
      mainInputContainer.classList.add('hidden');
    } else {
      mainInputContainer.classList.remove('hidden');
    }
  } else {
    document.getElementById('current-channel-title').textContent = `💬 DM with @${extraData}`;
    dmBlockToggleBtn.classList.remove('hidden'); currentDMTarget = extraData; checkDMBlockStatus(extraData);
    mainInputContainer.classList.remove('hidden');
  }
  
  currentReplyContext = null; replyBanner.classList.add('hidden');
  if (unsubscribeMessages) unsubscribeMessages(); if (unsubscribeTyping) unsubscribeTyping();
  loadMessages(); listenToTyping();
}

function loadMessages() {
  messagesContainer.innerHTML = '';
  const dbPath = currentChannelType === 'text' ? `messages_${currentChannel}` : `messages_dm_${currentChannel}`;
  const msgQuery = query(ref(db, dbPath), limitToLast(50));
  
  unsubscribeMessages = onValue(msgQuery, (snapshot) => {
    messagesContainer.innerHTML = '';
    let isScrolledToBottom = messagesContainer.scrollHeight - messagesContainer.clientHeight <= messagesContainer.scrollTop + 50;
    
    if (!snapshot.exists()) return;
    snapshot.forEach((childSnapshot) => {
      const msgId = childSnapshot.key;
      const data = childSnapshot.val();
      
      const isMentioned = data.text && data.text.includes(`@${currentActiveUser}`);
      const isRepliedToMe = data.replyTo && data.replyTo.username === currentActiveUser;

      const messageDiv = document.createElement('div');
      messageDiv.classList.add('message');
      if (isMentioned || isRepliedToMe) messageDiv.classList.add('highlighted-mention');
      
      let badges = (data.username === 'thecoolwebsitemaker') ? ' <span class="dev-badge" title="Web Developer">💻</span>' : '';
      if (data.isStaff) badges += ' <span class="staff-badge" title="Staff">🛡️</span>';
      if (data.isHelper) badges += ' <span class="helper-badge" title="Helper">🛠</span>';
      
      const time = new Date(data.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
      const safeText = data.text ? data.text.replace(/</g, "&lt;").replace(/>/g, "&gt;") : "";
      
      let replyHTML = '';
      if (data.replyTo) replyHTML = `<div class="replied-message-block"><span class="replied-author">@${data.replyTo.displayName || data.replyTo.username}</span><span class="replied-text">${data.replyTo.text}</span></div>`;
      
      let attachHTML = '';
      if (data.attachment) {
        if(data.attachment.type.startsWith('image/')) attachHTML = `<div class="attachment-container"><img src="${data.attachment.url}" loading="lazy"></div>`;
        else if(data.attachment.type.startsWith('video/')) attachHTML = `<div class="attachment-container"><video src="${data.attachment.url}" controls></video></div>`;
        else if(data.attachment.type.startsWith('audio/')) attachHTML = `<div class="attachment-container"><audio src="${data.attachment.url}" controls></audio></div>`;
        else attachHTML = `<div class="attachment-container" style="padding: 10px;"><a href="${data.attachment.url}" download="${data.attachment.name}" class="download-link">📎 Download ${data.attachment.name}</a></div>`;
      }
      
      let actionBtns = `<button class="reply-btn" data-username="${data.username}" data-displayname="${data.displayName || data.username}" data-text="${safeText}">Reply</button>`;
      
      if (data.username === currentActiveUser) {
        actionBtns += `<button class="edit-btn" data-id="${msgId}" data-text="${safeText}">Edit</button>`;
        actionBtns += `<button class="delete-btn" data-id="${msgId}">Delete</button>`;
      } else if (currentUserData.isStaff || currentUserData.isHelper || currentActiveUser === 'thecoolwebsitemaker') {
        actionBtns += `<button class="delete-btn" data-id="${msgId}">Delete</button>`;
      }

      if ((currentUserData.isStaff || currentActiveUser === 'thecoolwebsitemaker') && !data.isStaff && data.username !== currentActiveUser) {
        actionBtns += `<button class="admin-block-btn danger-btn" data-username="${data.username}">Block</button>`;
      } else if (currentUserData.isHelper && !data.isStaff && !data.isHelper && data.username !== currentActiveUser) {
        actionBtns += `<button class="request-block-btn secondary-btn" data-username="${data.username}">Req Block</button>`;
      }

      messageDiv.innerHTML = `
        <img src="${data.pfp || DEFAULT_PFP}" class="msg-pfp">
        <div class="msg-content">
          ${replyHTML}
          <div class="message-header">
            <span class="message-author" data-username="${data.username}">${data.displayName || data.username}${badges}</span>
            <span class="message-time">${time}</span>
          </div>
          <div class="message-text">${safeText}</div>
          ${attachHTML}
        </div>
        <div class="message-actions">${actionBtns}</div>
      `;
      messagesContainer.appendChild(messageDiv);
    });
    if (isScrolledToBottom) messagesContainer.scrollTop = messagesContainer.scrollHeight;
  });
}

fileUpload.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if(file) {
    if(file.size > MAX_FILE_SIZE) { alert("File > 5MB limit."); e.target.value = ''; return; }
    fileToBase64(file).then(b64 => { attachedFileData = { name: file.name, type: file.type, url: b64 }; filePreviewName.textContent = file.name; filePreview.classList.remove('hidden'); });
  }
});
document.getElementById('remove-file-btn').addEventListener('click', () => { attachedFileData = null; fileUpload.value = ''; filePreview.classList.add('hidden'); });

messageForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (currentUserData.mutedUntil && Date.now() < currentUserData.mutedUntil) {
    const minsLeft = Math.ceil((currentUserData.mutedUntil - Date.now()) / 60000);
    return alert(`You are muted for ${minsLeft} more minutes.`);
  }
  const now = Date.now();
  if (now - lastMessageTime < 2000 && !currentUserData.isStaff && !currentUserData.isHelper) return alert("Slow down (2s cooldown).");
  
  if (currentChannelType === 'dm' && currentDMTarget) {
    const checkTargetBlock = await get(child(dbRef, `user_dms_blocked/${currentDMTarget}/${currentActiveUser}`));
    if (checkTargetBlock.exists() && checkTargetBlock.val() === true) return alert("User has blocked you.");
  }
  
  const text = messageInput.value.trim();
  if (!text && !attachedFileData) return;
  
  const msgData = {
    username: currentActiveUser, displayName: currentUserData.displayName || currentActiveUser,
    pfp: currentUserData.pfp || DEFAULT_PFP, isStaff: !!currentUserData.isStaff, isHelper: !!currentUserData.isHelper,
    text, timestamp: serverTimestamp()
  };
  
  if (currentReplyContext) msgData.replyTo = currentReplyContext;
  if (attachedFileData) msgData.attachment = attachedFileData;
  
  const dbPath = currentChannelType === 'text' ? `messages_${currentChannel}` : `messages_dm_${currentChannel}`;
  try {
    await push(ref(db, dbPath), msgData);
    if(currentChannelType === 'dm' && currentDMTarget) await set(ref(db, `user_dms/${currentDMTarget}/${currentChannel}`), currentActiveUser);
    lastMessageTime = Date.now(); messageInput.value = ''; attachedFileData = null;
    fileUpload.value = ''; filePreview.classList.add('hidden');
    currentReplyContext = null; replyBanner.classList.add('hidden');
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    setTypingStatus(false);
  } catch (error) { alert("Failed to send."); }
});

messageInput.addEventListener('input', () => {
  setTypingStatus(messageInput.value.trim().length > 0);
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => setTypingStatus(false), 3000);
});

async function setTypingStatus(isTyping) {
  if(!currentActiveUser) return;
  const path = currentChannelType === 'text' ? `typing_${currentChannel}/${currentActiveUser}` : `typing_dm_${currentChannel}/${currentActiveUser}`;
  if(isTyping) await set(ref(db, path), currentUserData.displayName || currentActiveUser);
  else await remove(ref(db, path));
}

function listenToTyping() {
  const path = currentChannelType === 'text' ? `typing_${currentChannel}` : `typing_dm_${currentChannel}`;
  unsubscribeTyping = onValue(ref(db, path), (snap) => {
    let typers = [];
    if(snap.exists()) {
      snap.forEach(c => { if(c.key !== currentActiveUser) typers.push(c.val()); });
    }
    if(typers.length > 0) {
      typingIndicator.textContent = typers.length > 2 ? 'Several people are typing...' : `${typers.join(', ')} ${typers.length === 1 ? 'is' : 'are'} typing...`;
      typingIndicator.classList.remove('hidden');
    } else typingIndicator.classList.add('hidden');
  });
}
