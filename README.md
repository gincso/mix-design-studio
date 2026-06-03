# Mix Design Studio

Single-page asphalt mix design tool for comparing:

- agreed mix design vs implemented recipe
- target test results vs received test results
- scenario shifts, such as reducing `3/4" rock` and increasing crusher fines
- recommended adjustments to move the recipe toward a desired target
- combined aggregate gradation analysis
- saved batch history with backend persistence
- CSV and JSON import/export for the active case

## How to use

Run the backend and open the app:

```bash
npm start
```

Then open [http://localhost:3000](http://localhost:3000).

You can still open `index.html` directly for a local-only session, but batch history
will fall back to browser storage if the backend is unavailable.

## Notes

- The recommendation engine uses editable sensitivity coefficients.
- Those coefficients should be calibrated from your plant and lab history.
- The app is intended as a decision-support tool, not a replacement for lab validation.
- The backend stores cases in `data/cases.json`.
