import MyIcon from './icon.jpeg'
import './style.css'
import Data from './data.csv'
import Notes from './data.xml'
import toml from './data.toml'
import yaml from './data.yaml'
import json from './data.json5'
import printMe from './print'

console.log(toml)
console.log(toml.title)
console.log(toml.owner.name)

console.log(yaml)
console.log(yaml.title)
console.log(yaml.owner.name)

console.log(json)
console.log(json.title)
console.log(json.owner.name)

console.log(Data)
console.log(Notes)

async function getComponent() {
	const div = document.createElement('div')
	div.classList.add('hello')
	
	const {default: _} = await import('lodash')
	
	const span = document.createElement('span')
	span.innerHTML = _.join(['Hello', 'Webpack'], ' ')
	div.appendChild(span)
	
	const myIcon = new Image()
	myIcon.src = MyIcon
	div.appendChild(myIcon)
	
	const btn = document.createElement('button')
	btn.innerHTML = 'Click me and check the console'
	btn.onclick = printMe
	div.appendChild(btn)
	
	return div
}

getComponent().then((component) => {
	document.body.appendChild(component)
})
