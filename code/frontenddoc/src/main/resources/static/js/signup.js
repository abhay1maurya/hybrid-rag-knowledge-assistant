function signupDemo(event) {
  event.preventDefault();
  
  const company = document.getElementById('company').value.trim();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value.trim();
  const confirm = document.getElementById('confirm').value.trim();
  const note = document.getElementById('note');
  
  // Reset classes to base state
  note.className = 'note-text';
  
  if (!company || !email || !password || !confirm) {
    note.textContent = 'Please fill in all fields.';
    note.classList.add('text-error');
    return;
  }
  
  if (password !== confirm) {
    note.textContent = 'Passwords do not match.';
    note.classList.add('text-error');
    return;
  }
  
  if (password.length < 8) {
    note.textContent = 'Password must be at least 8 characters.';
    note.classList.add('text-error');
    return;
  }
  
  note.textContent = 'Account created! Redirecting to dashboard...';
  note.classList.add('text-success');
  
  setTimeout(() => { 
    window.location.href = 'dashboard.html'; 
  }, 800);
}