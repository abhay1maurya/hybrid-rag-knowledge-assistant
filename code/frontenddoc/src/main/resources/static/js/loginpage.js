function loginDemo(event) {
  event.preventDefault();
  
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value.trim();
  const note = document.getElementById('note');
  
  // Reset classes to base state
  note.className = 'note-text'; 
  
  if (!email || !password) {
    note.textContent = 'Please enter email and password.';
    note.classList.add('text-error');
    return;
  }
  
  note.textContent = 'Signed in. Redirecting to dashboard...';
  note.classList.add('text-success');
  
  setTimeout(() => { 
    window.location.href = 'dashboard.html'; 
  }, 500);
}