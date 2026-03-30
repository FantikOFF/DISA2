document.addEventListener('DOMContentLoaded', function() {
  const logoutButton = document.getElementById('logoutButton');
  const adminTitle = document.getElementById('adminTitle');

  // Функция для проверки логина
  function checkLogin() {
    const username = 'admin'; // Замените на логику получения имени пользователя
    const password = 'password'; // Замените на логику получения пароля
    
    // Пример проверки (замените на реальную проверку на сервере)
    if (username === 'admin' && password === 'password') {
      // Успешный вход
      adminTitle.textContent = 'Админ'; // Отображает "Админ"
      logoutButton.style.display = 'block'; // Делает кнопку "Выйти" видимой
    } else {
      // Неверные данные
      adminTitle.textContent = 'Неверные данные'; // Отображает "Неверные данные"
      logoutButton.style.display = 'none'; // Скрывает кнопку "Выйти"
    }
  }

  // Запускаем проверку логина при загрузке страницы
  checkLogin();

  // Обработчик события выхода
  logoutButton.addEventListener('click', function() {
    adminTitle.textContent = 'Админ'; // Возвращаем "Админ"
    logoutButton.style.display = 'none'; // Скрываем кнопку "Выйти"
  });
});
