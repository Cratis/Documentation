// Default to dark theme if the user has not saved a preference
if (typeof localStorage !== 'undefined' && !localStorage.getItem('docfx-theme')) {
    document.documentElement.setAttribute('data-bs-theme', 'dark');
}

export default {
  iconLinks: [
    {
      icon: 'github',
      href: 'https://github.com/cratis',
      title: 'GitHub'
    }
  ]
}
