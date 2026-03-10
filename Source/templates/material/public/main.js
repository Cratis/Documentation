// Always use dark theme – no light/dark switching
document.documentElement.setAttribute('data-bs-theme', 'dark');
localStorage.setItem('theme', 'dark');

export default {
  defaultTheme: 'dark',
  iconLinks: [
    {
      icon: 'github',
      href: 'https://github.com/cratis',
      title: 'GitHub'
    }
  ]
}
