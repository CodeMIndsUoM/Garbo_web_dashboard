import coreWebVitals from "eslint-config-next/core-web-vitals";

export default [
	...coreWebVitals,
	{
		rules: {
			"react-hooks/set-state-in-effect": "off",
			"react-hooks/preserve-manual-memoization": "off",
			"react-hooks/purity": "off",
			"react-hooks/immutability": "off",
			"react-hooks/refs": "off"
		}
	}
];
