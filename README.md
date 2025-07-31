# Implant Simulator

A web-based visual prosthesis (phosphone) simulator for research, education, and accessibility awareness. Simulates how a person with a visual implant might perceive the world using a live camera feed, AI segmentation, and various visualization modes.

## Features

- **Live Camera Feed**: Uses your device's camera as input.
- **Visualization Modes**:
  - **Normal**: Standard camera view.
  - **Remove Background**: AI-powered background removal using MediaPipe Selfie Segmentation.
  - **Outline**: Shows only the white outline of the segmented foreground.
  - **Phosphone Simulation**:
    - **Outline Mode**: Dots (phosphones) along the outline of the segmented object.
    - **Overall Mode**: Dots in a 32x32 (adjustable) grid simulating the entire visual field.
    - **Grid Toggle**: Option to snap outline dots to a grid for realism.
- **Interactive Controls**:
  - Dropdown menu for mode selection
  - Slider for dot/grid density
  - Grid toggle button
- **Mobile Friendly**: Responsive design for phones and tablets.

## Screenshots

| Normal | Remove Background | Outline | Phosphone (Outline) | Phosphone (Overall) |
|--------|------------------|---------|---------------------|---------------------|
| ![Normal](docs/screenshot_normal.jpg) | ![Remove BG](docs/screenshot_removebg.jpg) | ![Outline](docs/screenshot_outline.jpg) | ![Phosphone Outline](docs/screenshot_phosphone_outline.jpg) | ![Phosphone Overall](docs/screenshot_phosphone_overall.jpg) |

## How It Works

- **Camera**: Uses `getUserMedia` to access your webcam.
- **Segmentation**: MediaPipe Selfie Segmentation (runs in-browser, no server needed).
- **Rendering**: Canvas overlays for outlines and phosphone dots.
- **UI**: Dropdown menu, slider, and grid toggle for easy interaction.

## Getting Started

1. **Clone the repository**
   ```sh
   git clone https://github.com/linusarneng/implant_simulator.git
   cd implant_simulator
   ```
2. **Open `index.html` in your browser**
   - No build step required. All code runs in the browser.
   - For best results, use Chrome or Edge (mobile supported).

## File Structure

```
implant_simulator/
├── index.html         # Main HTML file
├── style.css          # All styles (responsive/mobile)
├── main.js            # App logic (camera, segmentation, UI)
├── docs/              # Screenshots and documentation assets
└── ...
```

## Credits
- [MediaPipe Selfie Segmentation](https://google.github.io/mediapipe/solutions/selfie_segmentation.html)
- [BodyPix (legacy)](https://github.com/tensorflow/tfjs-models/tree/master/body-pix)
- Inspired by real-world visual prosthesis research

## License

MIT License. See [LICENSE](LICENSE) for details.

---

*Made with ❤️ by Linus Arneng. Contributions and feedback welcome!*
