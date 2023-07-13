export default class UniqueArray {
	public array: any[];
	private map: Map<any, number>;

	constructor() {
		this.array = [];
		this.map = new Map();
	}

	add(value) {
		if (!this.map.has(value.uuid)) {
			this.array.push(value);
			this.map.set(value.uuid, this.array.length - 1);
		}
	}

	remove(value) {
		const index = this.map.get(value.uuid);
		if (index === undefined) {
			return;
		}
		const lastElement = this.array[this.array.length - 1];

		this.array[index] = lastElement;
		this.array.pop();
		this.map.set(lastElement.uuid, index);
		this.map.delete(value.uuid);
	}

	contains(value) {
		return this.map.has(value.uuid);
	}

	reset() {
		this.array.length = 0;
		this.map.clear();
	}

	get length() {
		return this.array.length;
	}

	concat(array) {
		for (let i = 0; i < array.length; i++) {
			this.add(array[i]);
		}
	}
}
