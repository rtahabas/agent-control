import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

/**
 * The rules worth having here are react-hooks. This dashboard is a long-lived
 * client surface with streams, refs and listeners bound once, and its worst bugs
 * have been dependency and lifecycle mistakes that type-checking cannot see.
 */
export default defineConfig([
  ...nextVitals,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "coverage/**"]),
  {
    rules: {
      /**
       * Ships as a warning, which means a genuine missing dependency exits zero
       * and sails through CI — verified by planting one. Since catching exactly
       * this is why the linter is here, it has to fail the build. The codebase
       * has no violations today, so promoting it costs nothing now and only
       * bites when something real appears.
       */
      "react-hooks/exhaustive-deps": "error",

      /**
       * A file past this length has usually stopped being one thing. Nine files
       * were already over when the rule arrived, none of them written for this
       * budget, so it starts as a warning rather than a wall — promote it once
       * that list is empty. Comments and blanks do not count: the target is
       * how much a file does, not how much it explains.
       */
      "max-lines": [
        "warn",
        { max: 150, skipBlankLines: true, skipComments: true },
      ],
      /**
       * Every page here loads its data on mount and puts it in state. React now
       * argues against that shape, and the argument has merit — but it is the
       * shape of all sixteen screens, and rewriting a working dashboard to
       * satisfy a lint rule trades a real regression risk for a stylistic win.
       * Left as a warning so new instances stay visible and the case can be
       * revisited deliberately, rather than silenced and forgotten.
       */
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  {
    // Chat renders pasted screenshots from base64 data URLs; next/image wants a
    // known source it can optimise, which a data URL is not.
    files: ["src/components/chat/**"],
    rules: { "@next/next/no-img-element": "off" },
  },
  {
    // A long test file is usually many cases against one unit, which is the
    // shape we want; splitting it to satisfy a line budget scatters them.
    files: ["src/__tests__/**"],
    rules: { "max-lines": "off" },
  },
]);
