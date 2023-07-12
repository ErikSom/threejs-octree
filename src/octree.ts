import { Mesh, MeshBasicMaterial, Plane, Ray, SphereGeometry, Vector3 } from "three";
import { OctreeBlock } from "./block";
import UniqueArray from "./uniqueArray";


export default class Octree<T> {
    public blocks: Array<OctreeBlock<T>>;

    private _maxBlockCapacity: number;
    private _selectionContent: UniqueArray;

    constructor(
        maxBlockCapacity?: number,
        public maxDepth = 2
    ) {
        this._maxBlockCapacity = maxBlockCapacity || 64;
        this._selectionContent = new UniqueArray();
    }

    public initialize(worldMin: Vector3, worldMax: Vector3, entries: Mesh[]): void {
        OctreeBlock.CreateBlocks(worldMin, worldMax, entries, this._maxBlockCapacity, 0, this.maxDepth, this);
    }

    public addMesh(entry: Mesh): void {
        for (let index = 0; index < this.blocks.length; index++) {
            const block = this.blocks[index];
            block.addEntry(entry);
        }
    }

    public removeMesh(entry: Mesh): void {
        for (let index = 0; index < this.blocks.length; index++) {
            const block = this.blocks[index];
            block.removeEntry(entry);
        }
    }

    public updateMesh(entry: Mesh): void {
        this.removeMesh(entry);
        this.addMesh(entry);
    }

    public inFrustum(frustumPlanes: Plane[]): UniqueArray {
        this._selectionContent.reset();

        for (let index = 0; index < this.blocks.length; index++) {
            const block = this.blocks[index];
            block.inFrustum(frustumPlanes, this._selectionContent);
        }

        return this._selectionContent;
    }

    public intersects(sphereCenter: Vector3, sphereRadius: number): UniqueArray {
        this._selectionContent.reset();

        const w: any = window;

        if(w.sphere){
            w.sphere.position.copy(sphereCenter);
            w.sphere.scale.set(sphereRadius, sphereRadius, sphereRadius);
        } else {
            w.sphere = new Mesh(new SphereGeometry(1.0, 32, 32), new MeshBasicMaterial({ color: 0xff0000, wireframe: true }));
            w.scene.add(w.sphere);
            w.sphere.position.copy(sphereCenter);
            w.sphere.scale.set(sphereRadius, sphereRadius, sphereRadius);
        }

        for (let index = 0; index < this.blocks.length; index++) {
            const block = this.blocks[index];
            block.intersects(sphereCenter, sphereRadius, this._selectionContent);
        }

        return this._selectionContent;
    }

    public intersectsRay(ray: Ray): UniqueArray {
        this._selectionContent.reset();

        for (let index = 0; index < this.blocks.length; index++) {
            const block = this.blocks[index];
            block.intersectsRay(ray, this._selectionContent);
        }

        return this._selectionContent;
    }

    public debugDraw(): void {
        for (let index = 0; index < this.blocks.length; index++) {
            const block = this.blocks[index];
            block.debugDraw();
        }
    }
}
