/* global document, HTMLInputElement, FormData, fetch, localStorage, setTimeout */

const form = document.querySelector('#login-form');
const message = document.querySelector('#form-message');
const submitButton = form?.querySelector('.submit-button');
const emailInput = document.querySelector('#email');
const passwordInput = document.querySelector('#password');
const toastRegion = document.querySelector('#toast-region');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const toastDuration = 4600;

function setMessage(text, state = 'error') {
  if (!message) {
    return;
  }

  message.textContent = text;
  message.dataset.state = state;
}

function showToast(text, state = 'error') {
  if (!toastRegion) {
    setMessage(text, state);
    return;
  }

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.dataset.state = state;
  toast.setAttribute('role', state === 'error' ? 'alert' : 'status');
  toast.textContent = text;

  toastRegion.append(toast);

  setTimeout(() => {
    toast.dataset.leaving = 'true';
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  }, toastDuration);
}

function setFieldError(input, text) {
  if (!(input instanceof HTMLInputElement)) {
    return;
  }

  input.setAttribute('aria-invalid', text ? 'true' : 'false');

  const field = input.closest('.field');
  if (!field) {
    return;
  }

  let error = field.querySelector('.field-error');

  if (!text) {
    error?.remove();
    return;
  }

  if (!error) {
    error = document.createElement('p');
    error.className = 'field-error';
    field.append(error);
  }

  error.textContent = text;
}

function validateField(input, shouldToast = false) {
  if (!(input instanceof HTMLInputElement)) {
    return true;
  }

  const error =
    input.id === 'email'
      ? !input.value.trim()
        ? 'Введіть пошту.'
        : EMAIL_PATTERN.test(input.value.trim())
          ? ''
          : 'Введіть коректну пошту.'
      : input.value
        ? ''
        : 'Введіть пароль.';

  setFieldError(input, error);

  if (error && shouldToast) {
    showToast(error);
  }

  return !error;
}

function validateForm(shouldToast = false) {
  const isEmailValid = validateField(emailInput, shouldToast);
  const isPasswordValid = validateField(passwordInput, shouldToast && isEmailValid);

  return isEmailValid && isPasswordValid;
}

document.querySelectorAll('[data-toggle-password]').forEach((button) => {
  button.addEventListener('click', () => {
    const input = document.getElementById(button.dataset.togglePassword);

    if (!(input instanceof HTMLInputElement)) {
      return;
    }

    const shouldShow = input.type === 'password';
    input.type = shouldShow ? 'text' : 'password';
    button.setAttribute('aria-label', shouldShow ? 'Сховати пароль' : 'Показати пароль');
  });
});

emailInput?.addEventListener('input', () => {
  validateField(emailInput);
  setMessage('');
});

passwordInput?.addEventListener('input', () => {
  validateField(passwordInput);
  setMessage('');
});

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  setMessage('');

  if (!validateForm(true)) {
    return;
  }

  const data = new FormData(form);
  const email = String(data.get('email') ?? '').trim();
  const password = String(data.get('password') ?? '');

  submitButton.disabled = true;
  submitButton.textContent = 'Входимо...';

  try {
    const response = await fetch('/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      const text = body.message ?? 'Не вдалося увійти.';
      setMessage(text);
      showToast(text);
      return;
    }

    localStorage.setItem('kanriAccessToken', body.accessToken);
    localStorage.setItem('kanriRefreshToken', body.refreshToken);
    setMessage('Вхід успішний.', 'success');
    showToast('Вхід успішний.', 'success');
  } catch {
    const text = 'Сервер тимчасово недоступний.';
    setMessage(text);
    showToast(text);
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'Увійти';
  }
});
