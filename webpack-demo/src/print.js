export default async function printMe() {
	const {default: _} = await import('lodash')
	console.log(_.join(['Another', 'module', 'loaded!'], ' '));
	console.log('I get called from print.js')
}