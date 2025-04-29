import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";
import pluginImport from "eslint-plugin-import";

export default [
  { languageOptions: { globals: globals.node } }, // Especificar entorno Node.js
  pluginJs.configs.recommended, // Reglas recomendadas de ESLint base
  ...tseslint.configs.recommended, // Reglas recomendadas de TypeScript-ESLint
  {
    // Configuración específica para archivos TS en functions
    files: ["src/**/*.ts"],
    languageOptions: {
      parserOptions: {
        project: true, // Busca tsconfig.json cercano
      },
    },
    plugins: {
      import: pluginImport,
    },
    rules: {
      // Aquí puedes añadir o sobreescribir reglas específicas para tus funciones
      "import/no-unresolved": "off", // A menudo útil en Cloud Functions
      "@typescript-eslint/no-unused-vars": "warn", // Avisar sobre variables no usadas
      // Mantener consistencia en comillas (ejemplo)
      "quotes": ["error", "double"], 
      // Ajustar otras reglas según sea necesario
      // Ejemplo: la regla que daba problemas, asegurando configuración por defecto razonable
      "@typescript-eslint/no-unused-expressions": ["error", { "allowShortCircuit": true, "allowTernary": true }],
    },
  },
  {
    // Ignorar la carpeta lib (archivos compilados)
    ignores: ["lib/**/*"],
  },
]; 