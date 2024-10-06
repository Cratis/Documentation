# Documentation Site project

Documentation is kept close to the code that it documents, this means we have documentation in most Cratis repositories.
The documentation is then added as Git sub modules. Check out this repository using the following:

```shell
git clone --recursive https://github.com/cratis/Documentation.git
```

If you have already cloned it without recursive sub modules, you can initialize it using the following:

```shell
git submodule update --init --recursive
```

To get started with local development perform a `dotnet restore` and then `yarn`.
Then all you need to do is run `yarn watch` and after build and the Web server has started navigate to [http://localhost:8080](http://localhost:8080).
It will watch for any changes and rebuild and restart the web server after this.

Everything is configured through the `docfx.json` file, documentation for the file can be found [here](https://dotnet.github.io/docfx/tutorial/docfx.exe_user_manual.html#3-docfxjson-format).

## Template

We've configured using the [SingulinkFX](https://github.com/Singulink/SingulinkFX) template.

## Resources

[Customizing](https://www.cazzulino.com/customize-docfx.html)
[.NET Docs config](https://github.com/dotnet/docs/blob/main/docfx.json)
