import { Box3, BoxGeometry, Mesh, MeshBasicMaterial, Vector3 } from "three";
import { mulberry32 } from "./utils/seededrandom";
import Octree from "../octree";

it('Should correctly add and remove a mesh', () => {
    const octree = new Octree(1, 2);
    const mesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());

	const extent = 10;

    octree.initialize(new Vector3(-extent, -extent, -extent), new Vector3(extent, extent, extent), [mesh]);
    expect(octree.blocks.every(block => block.entries.array.includes(mesh))).toBe(true);

    octree.removeMesh(mesh);
    expect(octree.blocks.every(block => !block.entries.array.includes(mesh))).toBe(true);
});

it('Should correctly add and remove multiple meshes', () => {
	const octree = new Octree(2, 2);
	const mesh1 = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
	const mesh2 = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());

	const extent = 10;

	mesh2.position.set(extent, extent, extent);
	mesh2.updateMatrixWorld(true);

	octree.initialize(new Vector3(-extent, -extent, -extent), new Vector3(extent, extent, extent), [mesh1, mesh2]);

	expect(octree.blocks.every(block => block.entries.array.includes(mesh1))).toBe(true);

	// we should only have one block with mesh2
	expect(octree.blocks.filter(block => block.entries.array.includes(mesh2)).length).toBe(1);

	octree.removeMesh(mesh1);
	expect(octree.blocks.every(block => !block.entries.array.includes(mesh1))).toBe(true);

	// we should still have one block with mesh2
	expect(octree.blocks.filter(block => block.entries.array.includes(mesh2)).length).toBe(1);

	octree.removeMesh(mesh2);

	expect(octree.blocks.filter(block => block.entries.length > 0).length).toBe(0);
});

it('Should fold when adding more than maxBlockCapacity meshes', async () => {
	const octree = new Octree(1, 2);
	const mesh1 = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
	const mesh2 = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());

	const extent = 10;

	mesh1.position.set(-extent, -extent, -extent);
	mesh1.updateMatrixWorld(true);
	mesh2.position.set(-extent, -extent, -extent);
	mesh2.updateMatrixWorld(true);

	octree.initialize(new Vector3(-extent, -extent, -extent), new Vector3(extent, extent, extent), [mesh1, mesh2]);

	await new Promise(resolve => setTimeout(resolve, 0));

	// no root block should have any entries
	expect(octree.blocks.every(block => block.entries.length === 0)).toBe(true);

	// the first block child should have both meshes
	expect(octree.blocks[0].blocks!.some(block => block.entries.length === 2)).toBe(true);
});

it('Should unfold when removing meshes', async () => {
	const octree = new Octree(1, 2);
	const mesh1 = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
	const mesh2 = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());

	const extent = 10;

	mesh1.position.set(-extent, -extent, -extent);
	mesh1.updateMatrixWorld(true);
	mesh2.position.set(-extent, -extent, -extent);
	mesh2.updateMatrixWorld(true);

	octree.initialize(new Vector3(-extent, -extent, -extent), new Vector3(extent, extent, extent), [mesh1, mesh2]);

	await new Promise(resolve => setTimeout(resolve, 0));

	// no root block should have any entries
	expect(octree.blocks.every(block => block.entries.length === 0)).toBe(true);

	// the first block child should have both meshes
	expect(octree.blocks[0].blocks!.some(block => block.entries.length === 2)).toBe(true);

	octree.removeMesh(mesh1);

	await new Promise(resolve => setTimeout(resolve, 0));

	// we should have unfolded
	expect(octree.blocks[0].blocks === null).toBe(true);

	// root block should have mesh2
	expect(octree.blocks.some(block => block.entries.array.includes(mesh2))).toBe(true);
});
