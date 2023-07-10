import { Box3, Box3Helper, BufferGeometry, Color, Mesh, Plane, Ray, Sphere, Vector3 } from "three";
import UniqueArray from "./uniqueArray";

export interface IOctreeContainer<T> {
    blocks: Array<OctreeBlock<T>>;
}
const dotCoordinate = (plane, point)  => plane.normal.x * point.x + plane.normal.y * point.y + plane.normal.z * point.z + plane.constant;
const debugDrawColor = new Color(0, 1, 0);

interface IOctreeMesh {
    _maxBoundingBox?: Box3;
    geometry: BufferGeometry;
}

export class OctreeBlock<T> {
    public entries = new Array<Mesh>();
    public blocks: Array<OctreeBlock<T>> | null = null;

    private _sphere: Sphere = new Sphere();
    private _depth: number;
    private _maxDepth: number;
    private _capacity: number;
    private _minPoint: Vector3;
    private _maxPoint: Vector3;
    private _box: Box3 = new Box3();
    private _boundingVectors = new Array<Vector3>();

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

    public addEntry(entry: Mesh): void {
        if (this.blocks) {
            for (let index = 0; index < this.blocks.length; index++) {
                const block = this.blocks[index];
                block.addEntry(entry);
            }
            return;
        }

        // Using a max bounding box so we can cache the result for any given orientation of the mesh
        this.computeMaxBoundingBox(entry as IOctreeMesh);

        const boundingBoxWorld = (entry as IOctreeMesh)._maxBoundingBox?.clone().applyMatrix4(entry.matrixWorld);

        if (boundingBoxWorld?.intersectsBox(this.box)) {
            this.entries.push(entry);
        }

        if (this.entries.length > this.capacity && this._depth < this._maxDepth) {
            this.createInnerBlocks();
        }
    }

    private computeMaxBoundingBox(entry: IOctreeMesh) {

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

    public removeEntry(entry: Mesh): void {
        if (this.blocks) {
            for (let index = 0; index < this.blocks.length; index++) {
                const block = this.blocks[index];
                block.removeEntry(entry);
            }

            let totalEntries = 0;
            for (let index = 0; index < this.blocks.length; index++) {
                totalEntries += this.blocks[index].entries.length;
            }

            // If total entries in child blocks is less than capacity, collapse the blocks
            if (totalEntries < this._capacity) {
                for (let index = 0; index < this.blocks.length; index++) {
                    this.entries = this.entries.concat(this.blocks[index].entries);
                    this.blocks[index].destroy();
                }
                this.blocks = null;
                this.destroyDebugDraw();
            }

            return;
        }

        const entryIndex = this.entries.indexOf(entry);

        if (entryIndex > -1) {
            this.entries.splice(entryIndex, 1);
        }
    }

    public addEntries(entries: Mesh[]): void {
        for (let index = 0; index < entries.length; index++) {
            const mesh = entries[index];
            this.addEntry(mesh);
        }
    }

    public select(frustumPlanes: Plane[], selection: UniqueArray): void {
        for (let p = 0; p < 6; ++p) {
            let canReturnFalse = true;
            const frustumPlane = frustumPlanes[p];
            for (let i = 0; i < 8; ++i) {
                if (dotCoordinate(frustumPlane, this._boundingVectors[i]) >= 0) {
                    canReturnFalse = false;
                    break;
                }
            }
            if (canReturnFalse) {
                return;
            }
        }

        if (this.blocks) {
            for (let index = 0; index < this.blocks.length; index++) {
                const block = this.blocks[index];
                block.select(frustumPlanes, selection);
            }
            return;
        }

        selection.concat(this.entries);
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

            selection.concat(this.entries);
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
            selection.concat(this.entries);
        }
    }

    public createInnerBlocks(): void {
        OctreeBlock._CreateBlocks(this._minPoint, this._maxPoint, this.entries, this._capacity, this._depth, this._maxDepth, this as IOctreeContainer<T>);
        this.entries.splice(0);

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

            this.entries[0].parent?.add(boxHelper);

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

    public static _CreateBlocks<T>(
        worldMin: Vector3,
        worldMax: Vector3,
        entries: Mesh[],
        maxBlockCapacity: number,
        currentDepth: number,
        maxDepth: number,
        target: IOctreeContainer<T>,
    ): void {
        target.blocks = new Array<OctreeBlock<T>>();
        const blockSize = new Vector3((worldMax.x - worldMin.x) / 2, (worldMax.y - worldMin.y) / 2, (worldMax.z - worldMin.z) / 2);

        for (let x = 0; x < 2; x++) {
            for (let y = 0; y < 2; y++) {
                for (let z = 0; z < 2; z++) {
                    const localMin = worldMin.clone().add(new Vector3(x, y, z).multiply(blockSize));
                    const localMax = worldMin.clone().add(new Vector3(x + 1, y + 1, z + 1).multiply(blockSize));

                    const block = new OctreeBlock<T>(localMin, localMax, maxBlockCapacity, currentDepth + 1, maxDepth);
                    block.addEntries(entries);
                    target.blocks.push(block);
                }
            }
        }
    }
}
