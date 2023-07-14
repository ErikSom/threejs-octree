import { Box3, Box3Helper, BufferGeometry, Color, Frustum, Mesh, Ray, Sphere, Vector3 } from "three";
import UniqueArray from "./uniqueArray";

export interface IOctreeContainer<T> {
    blocks: Array<OctreeBlock<T>>;
    setDirty?(): void;
}
const debugDrawColor = new Color(0, 1, 0);

interface IOctreeMesh {
    _maxBoundingBox?: Box3;
    geometry: BufferGeometry;
}

export class OctreeBlock<T> {
    public entries = new UniqueArray();
    public blocks: Array<OctreeBlock<T>> | null = null;

    private _sphere: Sphere = new Sphere();
    private _depth: number;
    private _maxDepth: number;
    private _capacity: number;
    private _minPoint: Vector3;
    private _maxPoint: Vector3;
    private _box: Box3 = new Box3();
    private _boundingVectors = new Array<Vector3>();
    private _descendantCount: number = 0;
    private _root: IOctreeContainer<T>;

    private _debugDrawBox: Box3Helper | null = null;

    constructor(minPoint: Vector3, maxPoint: Vector3, capacity: number, depth: number, maxDepth: number) {
        this._capacity = capacity;
        this._depth = depth;
        this._maxDepth = maxDepth;

        this._minPoint = minPoint.clone();
        this._maxPoint = maxPoint.clone();

        this._box.min = minPoint.clone();
        this._box.max = maxPoint.clone();

        this._boundingVectors.push(minPoint.clone());
        this._boundingVectors.push(maxPoint.clone());

        this._boundingVectors.push(minPoint.clone());
        this._boundingVectors[2].x = maxPoint.x;

        this._boundingVectors.push(minPoint.clone());
        this._boundingVectors[3].y = maxPoint.y;

        this._boundingVectors.push(minPoint.clone());
        this._boundingVectors[4].z = maxPoint.z;

        this._boundingVectors.push(maxPoint.clone());
        this._boundingVectors[5].z = minPoint.z;

        this._boundingVectors.push(maxPoint.clone());
        this._boundingVectors[6].x = minPoint.x;

        this._boundingVectors.push(maxPoint.clone());
        this._boundingVectors[7].y = minPoint.y;
    }

    public get capacity(): number {
        return this._capacity;
    }

    public get box(): Box3 {
        return this._box;
    }

    public get depth(): number {
        return this._depth;
    }

    public get descendantCount(): number {
        return this._descendantCount;
    }

    public addEntry(entry: Mesh): boolean {
        if (this.blocks) {
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

            return added;
        }

        // Using a max bounding box so we can cache the result for any given orientation of the mesh
        this.computeMaxBoundingBox(entry as IOctreeMesh);

        const boundingBoxWorld = (entry as IOctreeMesh)._maxBoundingBox?.clone().applyMatrix4(entry.matrixWorld);

        let added = false;
        if (boundingBoxWorld?.intersectsBox(this.box)) {
            added = this.entries.add(entry);
        }

        if (this.entries.length > this.capacity && this._depth < this._maxDepth) {
            // if we have more entries than our capacity, set dirty on root
            this._root.setDirty?.();
        }

        return added;
    }

    private computeMaxBoundingBox(entry: IOctreeMesh) {

        if(entry._maxBoundingBox) return;

        entry.geometry.computeBoundingBox();

        const bounds:Box3 = entry.geometry.boundingBox!;

        const width = bounds.max.x - bounds.min.x;
        const height = bounds.max.y - bounds.min.y;
        const depth = bounds.max.z - bounds.min.z;

        const maxDimension = Math.max(width, height, depth);

        const boundingBox = new Box3();

        const halfSize = maxDimension / 2;

        boundingBox.min.set(-halfSize, -halfSize, -halfSize);
        boundingBox.max.set(halfSize, halfSize, halfSize);

        entry._maxBoundingBox = boundingBox
    }

    public removeEntry(entry: Mesh): boolean {
        if (this.blocks) {
            let removed = false;
            for (let index = 0; index < this.blocks.length; index++) {
                const block = this.blocks[index];
                if(block.removeEntry(entry)){
                    removed = true;
                };
            }

            if(removed){
                this._descendantCount--;
            }

            // If total descendants is less than capacity, set dirty on root
            if (this._descendantCount <= this._capacity) {
                this._root.setDirty?.();
            }

            return removed;
        }

        return this.entries.remove(entry);
    }

    public addEntries(entries: Mesh[]): void {
        for (let index = 0; index < entries.length; index++) {
            const mesh = entries[index];
            this.addEntry(mesh);
        }
    }

    public inFrustum(frustum: Frustum, selection: UniqueArray): void {
        if(!frustum.intersectsBox(this.box)){
            return;
        }

        if (this.blocks) {
            for (let index = 0; index < this.blocks.length; index++) {
                const block = this.blocks[index];
                block.inFrustum(frustum, selection);
            }
            return;
        }

        selection.concat(this.entries.array);
    }

    public intersects(sphereCenter: Vector3, sphereRadius: number, selection: UniqueArray): void {
        this._sphere.set(sphereCenter, sphereRadius);

        if (this.box.intersectsSphere(this._sphere)) {
            if (this.blocks) {
                for (let index = 0; index < this.blocks.length; index++) {
                    const block = this.blocks[index];
                    block.intersects(sphereCenter, sphereRadius, selection);
                }
                return;
            }

            selection.concat(this.entries.array);
        }
    }

    public intersectsRay(ray: Ray, selection: UniqueArray): void {
        if (ray.intersectsBox(this.box)) {
            if (this.blocks) {
                for (let index = 0; index < this.blocks.length; index++) {
                    const block = this.blocks[index];
                    block.intersectsRay(ray, selection);
                }
                return;
            }
            selection.concat(this.entries.array);
        }
    }

    public split(): void {
        OctreeBlock.CreateBlocks(this._minPoint, this._maxPoint, this.entries.array, this._capacity, this._depth, this._maxDepth, this as IOctreeContainer<T>, this._root);
        this.entries.reset();

        this.destroyDebugDraw();
    }

    public collapse(): void {
        this.entries = new UniqueArray();
        for (let index = 0; index < this.blocks!.length; index++) {
            this.entries.concat(this.blocks![index].entries.array);
            this.blocks![index].destroy();
        }
        this._descendantCount = this.entries.length;
        this.blocks = null;
        this.destroyDebugDraw();
    }

    public destroyDebugDraw(): void {
        if (this._debugDrawBox) {
            this._debugDrawBox.parent?.remove(this._debugDrawBox);
            this._debugDrawBox.dispose();
            this._debugDrawBox = null;
        }
    }

    public debugDraw(): void {
        if(this._debugDrawBox) return;

        if(this.entries.length > 0){
            const boxHelper = new Box3Helper(this.box, debugDrawColor);
            boxHelper.updateMatrixWorld(true);
            boxHelper.updateMatrix();

            this.entries.array[0].parent?.add(boxHelper);

            this._debugDrawBox = boxHelper;
        }

        if(this.blocks){
            for (let index = 0; index < this.blocks.length; index++) {
                const block = this.blocks[index];
                block.debugDraw();
            }
        }
    }

    public destroy(): void {
        if (this.blocks) {
            for (let index = 0; index < this.blocks.length; index++) {
                const block = this.blocks[index];
                block.destroy();
            }
        }

        this.destroyDebugDraw();
    }

    public static CreateBlocks<T>(
        worldMin: Vector3,
        worldMax: Vector3,
        entries: Mesh[],
        maxBlockCapacity: number,
        currentDepth: number,
        maxDepth: number,
        target: IOctreeContainer<T>,
        root: IOctreeContainer<T>,
    ): void {
        target.blocks = new Array<OctreeBlock<T>>();
        const blockSize = new Vector3((worldMax.x - worldMin.x) / 2, (worldMax.y - worldMin.y) / 2, (worldMax.z - worldMin.z) / 2);

        for (let x = 0; x < 2; x++) {
            for (let y = 0; y < 2; y++) {
                for (let z = 0; z < 2; z++) {
                    const localMin = worldMin.clone().add(new Vector3(x, y, z).multiply(blockSize));
                    const localMax = worldMin.clone().add(new Vector3(x + 1, y + 1, z + 1).multiply(blockSize));

                    const block = new OctreeBlock<T>(localMin, localMax, maxBlockCapacity, currentDepth + 1, maxDepth);
                    block._root = root;
                    block.addEntries(entries);
                    target.blocks.push(block);
                }
            }
        }
    }
}
