const gun = Gun();
const user = gun.user();
let chat = gun.get('gun-chat');
let messageListener = null;


const aliasInput = document.getElementById('alias');
const passInput = document.getElementById('password');
const loginStatus = document.getElementById('login-status');
const loginSection = document.getElementById('login-section');
const chatSection = document.getElementById('chat-section');
const messages = document.getElementById('messages');
const input = document.getElementById('message');
const typingDisplay = document.getElementById('typing');
const userList = document.getElementById('user-list');
const darkToggle = document.getElementById('dark-mode-toggle');

document.addEventListener('DOMContentLoaded', () => {
  if (localStorage.getItem('theme') === 'dark') {
    document.body.classList.add('dark-mode');
    darkToggle.textContent = '☀️ Light Mode';
  }
});

user.recall({ sessionStorage: true }, () => {
  if (user.is) showChat();
});

function login() {
  user.auth(aliasInput.value, passInput.value, ack => {
    loginStatus.textContent = ack.err ? `❌ ${ack.err}` : `✅ Logged in`;
    if (!ack.err) showChat();
  });
}

function signup() {
  user.create(aliasInput.value, passInput.value, ack => {
    if (!ack.err) login();
    else loginStatus.textContent = `❌ ${ack.err}`;
  });
}

function showChat() {
  loginSection.style.display = 'none';
  chatSection.style.display = 'block';
  listenForMessages();
  listenForTyping();
  listUsers();
}

function formatTimestamp() {
  const now = new Date();
  return `${now.toLocaleDateString()} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

const typingRef = gun.get('typing');
let typingTimeout;

function broadcastTyping() {
  user.get('alias').once(alias => {
    typingRef.get(alias).put(true);
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      typingRef.get(alias).put(null);
    }, 1500);
  });
}

function listenForTyping() {
  user.get('alias').once(myAlias => {
    typingRef.map().on((isTyping, alias) => {
      if (alias === myAlias) return;
      typingDisplay.textContent = isTyping ? `${alias} is typing...` : '';
    });
  });
}

function listenForMessages() {
  messages.innerHTML = '';

  if (messageListener) {
    messageListener.off(); // Detach previous listener
    messageListener = null;
  }

  messageListener = chat.map().on((msg, id) => {
    if (!msg || document.getElementById(id)) return;

    const div = document.createElement('div');
    div.className = 'message';
    div.id = id;
    div.innerHTML = `<strong>${msg.text}</strong><br><small>${msg.time}</small>`;

    if (msg.file) {
      const link = document.createElement('a');
      link.href = msg.file;
      link.download = msg.fileName;
      link.textContent = `📎 ${msg.fileName}`;
      div.appendChild(link);

      if (msg.fileType.startsWith('image/')) {
        const img = document.createElement('img');
        img.src = msg.file;
        img.style.maxWidth = '100%';
        div.appendChild(img);
      }
    }

    const seenDiv = document.createElement('div');
    seenDiv.className = 'seen-container';

    user.get('alias').once(myAlias => {
      chat.get(id).get('seenBy').get(myAlias).put(Date.now());

      chat.get(id).get('seenBy').map().on((ts, alias) => {
        if (alias !== myAlias && ts) {
          const tag = document.createElement('small');
          tag.textContent = `👀 Seen by ${alias}`;
          seenDiv.appendChild(tag);
        }
      });
    });

    div.appendChild(seenDiv);

    if (msg.owner === user.is.pub) {
      const delBtn = document.createElement('button');
      delBtn.textContent = '🗑️ Delete';
      delBtn.className = 'inline-btn';
      delBtn.onclick = () => {
        if (confirm("Delete this message?")) {
          chat.get(id).put(null);
          div.remove();
        }
      };
      div.appendChild(delBtn);
    }

    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
  });
}


function send() {
  const text = input.value.trim();
  if (!text) return;

  user.get('alias').once(alias => {
    chat.set({
      text: `${alias}: ${text}`,
      time: formatTimestamp(),
      owner: user.is.pub
    });
    input.value = '';
  });
}

function deleteChat() {
  if (!confirm("Delete all your messages?")) return;
  chat.map().once((msg, id) => {
    if (msg?.owner === user.is.pub) {
      chat.get(id).put(null);
      document.getElementById(id)?.remove();
    }
  });
}

function toggleDarkMode() {
  document.body.classList.toggle('dark-mode');
  const isDark = document.body.classList.contains('dark-mode');
  darkToggle.textContent = isDark ? '☀️ Light Mode' : '🌙 Dark Mode';
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

function logout() {
  user.leave();
  sessionStorage.clear();
  messages.innerHTML = '';
  chatSection.style.display = 'none';
  loginSection.style.display = 'block';
}

function uploadFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    user.get('alias').once(alias => {
      chat.set({
        text: `${alias} sent a file:`,
        file: reader.result,
        fileName: file.name,
        fileType: file.type,
        time: formatTimestamp(),
        owner: user.is.pub
      });
    });
  };
  reader.readAsDataURL(file);
}

function listUsers() {
  user.get('alias').once(myAlias => {
    gun.get('~@').map().once((_, alias) => {
      if (alias === myAlias) return;
      const btn = document.createElement('button');
      btn.textContent = `💬 DM ${alias}`;
      btn.onclick = () => openPrivateChat(alias);
      userList.appendChild(btn);
    });
  });
}

function openPrivateChat(otherAlias) {
  user.get('alias').once(myAlias => {
    const room = [myAlias, otherAlias].sort().join('-');
    chat = gun.get(`dm-${room}`);
    messages.innerHTML = `<p style="color:gray">🔒 Chatting privately with <strong>${otherAlias}</strong></p>`;
    listenForMessages();
  });
}
