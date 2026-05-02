const hardcodedColorRule = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow hardcoded Tailwind color classes",
      category: "Design Tokens",
      recommended: true,
    },
    messages: {
      noHardcodedColors: "Use design tokens (var(--surface), var(--primary)) instead of hardcoded colors like '{{color}}'",
    },
  },
  create(context) {
    return {
      JSXAttribute(node) {
        if (node.value?.type === "Literal" && typeof node.value?.value === "string") {
          const value = node.value.value;
          const hardcodedColors = /\bbg-(blue|red|green|yellow|orange|purple|pink|indigo|cyan|teal|gray|slate|neutral|stone)-(50|100|200|300|400|500|600|700|800|900)\b/;
          if (hardcodedColors.test(value)) {
            context.report({
              node,
              messageId: "noHardcodedColors",
              data: { color: value },
            });
          }
        }
      },
    };
  },
};

const arbitrarySpacingRule = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow arbitrary pixel spacing values",
      category: "Design Tokens",
      recommended: true,
    },
    messages: {
      noArbitrarySpacing: "Use 8pt grid spacing (gap-2, gap-4, gap-6, gap-8) instead of '{{value}}'",
    },
  },
  create(context) {
    return {
      JSXAttribute(node) {
        if (node.value?.type === "Literal" && typeof node.value?.value === "string") {
          const value = node.value.value;
          const arbitrarySpacing = /\b(p|m|gap|px|py|mx|my)-(5|[1-9]\d|1[0-9])\b/;
          if (arbitrarySpacing.test(value)) {
            context.report({
              node,
              messageId: "noArbitrarySpacing",
              data: { value },
            });
          }
        }
      },
    };
  },
};

module.exports = {
  rules: {
    "no-hardcoded-colors": hardcodedColorRule,
    "no-arbitrary-spacing": arbitrarySpacingRule,
  },
};