// Form Save Logic
function saveProfile(e) {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  const n = document.getElementById('saved');
  
  const originalText = btn.innerText;
  btn.innerText = "Saving...";
  btn.disabled = true;

  setTimeout(() => {
    n.classList.remove('hidden');
    btn.innerText = originalText;
    btn.disabled = false;
    setTimeout(() => n.classList.add('hidden'), 2500);
  }, 800);
}

// Profile Avatar Upload
function setupAvatarUpload() {
  const avatar = document.getElementById('profile-avatar');
  const fileInput = document.getElementById('avatar-upload');
  
  if (avatar && fileInput) {
    avatar.addEventListener('click', () => {
      fileInput.click();
    });
    
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          avatar.textContent = '';
          const img = document.createElement('img');
          img.src = event.target.result;
          img.style.width = '100%';
          img.style.height = '100%';
          img.style.objectFit = 'cover';
          img.style.borderRadius = '50%';
          avatar.appendChild(img);
          avatar.style.background = 'none';
          avatar.style.boxShadow = 'none';
        };
        reader.readAsDataURL(file);
      }
    });
  }
}

// Interactive Button Logic
document.addEventListener('DOMContentLoaded', () => {
  // Setup Avatar Upload
  setupAvatarUpload();
  
  // Security Buttons
  const btnPassword = document.getElementById('btn-password');
  if(btnPassword) {
    btnPassword.onclick = () => {
      const pass = prompt("Enter current password to verify:");
      if (pass) alert("A password reset link has been sent to alexander@hybridrag.ai");
    };
  }

  const btn2fa = document.getElementById('btn-2fa');
  if(btn2fa) {
    btn2fa.onclick = () => {
      alert("Two-Factor Authentication is currently managed via your Authenticator App.");
    };
  }

  const btnSessions = document.getElementById('btn-sessions');
  if(btnSessions) {
    btnSessions.onclick = () => {
      alert("Current Sessions:\n• Chrome on macOS (This device)\n• Mobile App (iOS) - Last active 2h ago");
    };
  }

  // Danger Zone Buttons
  const btnDownload = document.getElementById('btn-download');
  if(btnDownload) {
    btnDownload.onclick = () => {
      if(confirm("Generate a portable ZIP of all your workspace data? This may take a few minutes.")) {
        alert("Request received. We'll email you when the export is ready.");
      }
    };
  }

  const btnDelete = document.getElementById('btn-delete');
  if(btnDelete) {
    btnDelete.onclick = () => {
      const confirmDelete = confirm("WARNING: This will permanently delete your account and all indexed documents.");
      if (confirmDelete) {
        const verify = prompt("Type 'CONFIRM' to delete your account:");
        if (verify === 'CONFIRM') {
          alert("Account deleted. Redirecting...");
          window.location.href = 'landingpage.html';
        }
      }
    };
  }
});