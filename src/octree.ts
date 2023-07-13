import { Camera, Frustum, Matrix4, Mesh, MeshBasicMaterial, Ray, SphereGeometry, Vector3 } from "three";
import { OctreeBlock } from "./block";
import UniqueArray from "./uniqueArray";

export default class Octree<T> {
    public blocks: Array<OctreeBlock<T>>;

    private _maxBlockCapacity: number;
    private _selectionContent: UniqueArray;
    private _frustum: Frustum = new Frustum();
    private _matrix: Matrix4 = new Matrix4();
    private _descendantCount: number = 0;

    private _nodesDirty: boolean = false;

    constructor(
        maxBlockCapacity?: number,
        public maxDepth = 2
    ) {
        this._maxBlockCapacity = maxBlockCapacity || 64;
        this._selectionContent = new UniqueArray();
    }

    public initialize(worldMin: Vector3, worldMax: Vector3, entries: Mesh[]): void {
        OctreeBlock.CreateBlocks(worldMin, worldMax, entries, this._maxBlockCapacity, 0, this.maxDepth, this, this);
    }

    private splitAndCollapse(blocks: Array<OctreeBlock<T>>): void {
        for (let index = 0; index < blocks.length; index++) {
            const block = blocks[index];

            if(!block.blocks){
                if (block.entries.length > block.capacity && block.depth < this.maxDepth) {
                    block.split();
                }
            } else {
                if(block.descendantCount <= block.capacity && block.depth > 0){
                   block.collapse();
                }else {
                    this.splitAndCollapse(block.blocks);
                }
            }
        }
    }

    public setDirty(): void {
        if(!this._nodesDirty){
            setTimeout(() => {
                this.splitAndCollapse(this.blocks)
                this._nodesDirty = false;
            }, 0);
        }
        this._nodesDirty = true;
    }

    public addMesh(entry: Mesh): void {
        let added = false;
        for (let index = 0; index < this.blocks.length; index++) {
            const block = this.blocks[index];
            if(block.addEntry(entry)){
                added = true;
            };
        }

        if(added){
            this._descendantCount++;
        }
    }

    public removeMesh(entry: Mesh): void {
        let removed = false;
        for (let index = 0; index < this.blocks.length; index++) {
            const block = this.blocks[index];
            if(block.removeEntry(entry)){
                removed = true;
            }
        }
        if(removed){
            this._descendantCount--;
        }
    }

    public updateMesh(entry: Mesh): void {
        this.removeMesh(entry);
        this.addMesh(entry);
    }

    public inFrustum(camera: Camera): UniqueArray {
        this._selectionContent.reset();

        this._matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
        this._frustum.setFromProjectionMatrix(this._matrix);

        for (let index = 0; index < this.blocks.length; index++) {
            const block = this.blocks[index];
            block.inFrustum(this._frustum, this._selectionContent);
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
