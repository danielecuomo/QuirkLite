# QuirkLite

![Demo](assets/demo1.gif)

QuirkLite is a lightweight, browser-based quantum circuit simulator derived from [Quirk](https://github.com/Strilanc/Quirk). It provides an interactive drag-and-drop interface for building and exploring small quantum circuits.

## Features

- **Drag-and-drop circuit editing**
- **Real-time quantum simulation**
- **Quantum state visualization**
- **Undo and redo**
- **Bookmarkable circuits** via the URL
- **Up to 16 qubits** for interactive simulation
- **Built-in examples**
- **Standalone HTML build**

## Getting started

### Use the prebuilt application

The production build is generated as:

```text
out/quirk.html
```

Open it in a modern web browser.

### Build from source

Requirements:

- Git
- Node.js
- npm
- A modern browser with JavaScript and WebGL support

Install dependencies:

```bash
npm install
```

Build:

```bash
npm run build
```

The generated application is written to `out/quirk.html`.

## Basic usage

| Action | How |
|---|---|
| Add a gate | Drag a gate from the toolbox onto the circuit |
| Move a gate | Drag it to another circuit position |
| Remove a gate | Drag it out of the circuit or use middle-click |
| Undo | `Ctrl+Z` or the **Undo** button |
| Redo | `Ctrl+Shift+Z`, `Ctrl+Y`, or the **Redo** button |
| Save a circuit | Bookmark the current URL |
| Load a circuit | Open the saved bookmark |
| Inspect state | Drag a display gate onto the circuit |

### Advanced editing

- **Copy a gate:** `Shift` + drag
- **Move a column:** `Ctrl` + drag
- **Copy a column:** `Ctrl` + `Shift` + drag

## Project structure

```text
QuirkLite/
├── html/       # HTML templates and UI partials
├── src/        # JavaScript source code
├── test/       # Unit and integration tests
├── doc/        # Documentation and media
├── out/        # Generated browser application
├── GruntFile.js
├── package.json
└── README.md
```

## Development

The project uses Grunt, Traceur, Uglify, and Karma. WebGL is used by parts of the rendering and simulation pipeline.

QuirkLite is intended for educational and exploratory use with small quantum circuits.

## License and attribution

QuirkLite is a customized fork of **Quirk**, originally developed by Craig Gidney and contributors.

The project retains the Apache License 2.0. See [`LICENSE`](LICENSE) for the full license text.

QuirkLite is an independent project and is not an official Google product.
