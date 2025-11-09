document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    const response = await fetch('/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (data.success) {
        if (data.userType === 'admin') {
            window.location.href = 'admin.html';
        } else {
            window.location.href = 'driver.html';
        }
    } else {
        alert('Credenciais inválidas');
    }
});
