import * as util from "./util";
import _ from "lodash";
import chalk from "chalk";

/**
 * Options for initializing a Grid
 */
export interface GridOptions {
	/**
	 * Initialize a grid from a string. Each grid row must be
	 * separated by a new line character and have the same
	 * number of characters per row.
	 */
	serialized?: string;

	/**
	 * Optional (defaults to space). If initializing a blank
	 * grid, fill each cell with this character. Must be a
	 * single-character string.
	 */
	fillWith?: string;

	/**
	 * Number of rows for this new blank grid.
	 */
	rowCount?: number;

	/**
	 * Number of columns for this new blank grid.
	 */
	colCount?: number;
}

/**
 * Settings for copying a grid
 */
export interface CopyGridOptions {
	/**
	 * Row in the source grid to start copying from. Defaults to 0.
	 */
	srcStartRow?: number;

	/**
	 * Column in the source grid to start copying from. Defaults to 0.
	 */
	srcStartCol?: number;

	/**
	 * Row in the source grid to finish copying from. Defaults to the row
	 * at srcStartRow + srcRowCount.
	 */
	srcEndRow?: number;

	/**
	 * Column in the source grid to finish copying from. Defaults to the
	 * column at srcStartCol + srcColCount.
	 */
	srcEndCol?: number;

	/**
	 * Number of source rows to copy. Defaults to all remaining rows.
	 */
	srcRowCount?: number;

	/**
	 * Number of source columns to copy. Defaults to all remaining columns.
	 */
	srcColCount?: number;

	/**
	 * Number of rows in the destination grid. Defaults to the number of
	 * copied rows from the source grid.
	 */
	destRowCount?: number;

	/**
	 * Number of columns in the destination grid. Defaults to the number
	 * of copied rows from the source grid.
	 */
	destColCount?: number;

	/**
	 * The row index to begin copying data to in the destination grid.
	 * Defaults to 0.
	 */
	destStartRow?: number;

	/**
	 * The column index to begin copying data to in the destination grid.
	 * Defaults to 0.
	 */
	destStartCol?: number;

	/**
	 * If false, leave the destination grid blank. Defaults to true.
	 */
	copyValues?: boolean;

	/**
	 * If the new grid is larger than the source grid, initialize those
	 * new cells with this value.
	 */
	fillNewCellsWith?: string;
}

/**
 * Options to edit the size of a grid
 */
export interface EditGridOptions {
	/**
	 * Number of rows to add (negative to delete) to the top of the grid
	 */
	top?: number;

	/**
	 * Number of columns to add (negative to delete) to the left of the grid
	 */
	left?: number;

	/**
	 * Number of columns to add (negative to delete) to the right of the grid
	 */
	right?: number;

	/**
	 * Number of rows to add (negative to delete) to the bottom of the grid
	 */
	bottom?: number;

	/**
	 * Sigil to fill new cells with.
	 */
	fillWith?: string;
}

/**
 * Tuple describing a (row, column) position on a grid.
 */
export type GridPos = [row: number, col: number];

/**
 * Options for moving from cell-to-cell
 * - "wrap":   If you go off the edge of the grid, wrap over
 *             to the other edge on the same axis.
 * - "stay":   If you go off the edge, just return the cell
 *             on that edge.
 * - "expand": If you go off the edge, increase the size of
 *             the grid in the direction(s) of movement.
 * - "none":   If you go off the edge, return undefined.
 * - Function: If a cell is returned, use that cell as the next
 *             position. Otherwise acts like "none".
 */
export type MoveOption = "wrap" | "stay" | "expand" | "none" | ((cell: Cell | undefined, origin: Cell) => GridPos);

/**
 * Options for moving from cell-to-cell
 */
export interface RepeatMovementsOptions {
	/**
	 * Number times to repeat the list of movements, or a function that returns false
	 * when the movement should stop. Default: 1
	 */
	count?: number | ((cell: Cell | undefined, origin: Cell) => boolean);

	/**
	 * Determines how to handle movement off the edge of the grid. Default: "none"
	 */
	moveOption?: MoveOption;

	/**
	 * If true, and if count is a function, force one iteration of movement,
	 * regardless of what the count function returns on the origin cell.
	 */
	forceOneMove?: boolean;

	/**
	 * If true, untrack the origin tracked cell, and start tracking the returned cell.
	 */
	updateTracking?: boolean;

	/**
	 * Whether or not to transfer data to the new cell. Default: false
	 */
	transferData?: boolean;
}

const DEFAULT_FILL = " ";

const COLOR_ORDER = [
	chalk.yellowBright,
	chalk.blueBright,
	chalk.greenBright,
	chalk.blueBright,
	chalk.redBright,
	chalk.cyanBright,
] as const;

/**
 * List of common directions
 */
export const Dir: Obj<GridPos> = {
	N: [-1, 0],
	U: [-1, 0],

	E: [0, 1],
	R: [0, 1],

	S: [1, 0],
	D: [1, 0],

	W: [0, -1],
	L: [0, -1],

	NE: [-1, 1],
	SE: [1, 1],
	SW: [1, -1],
	NW: [-1, -1],
};

/**
 * Character-based Grid data structure. Grids have finite size.
 * Each cell is expected to be a single printable character.
 */
export class Grid {
	private numRows: number;
	private numCols: number;
	private grid: string[][] = [];
	private nextColor = 0;
	private sigilStats: { [sigil: string]: { colorIndex: number; count: number } } = {};
	private batchUpdatedGrid: Grid | undefined;
	private fillWith: string;
	private trackedCells: Map<string, Cell> = new Map();

	constructor(options: GridOptions) {
		if ((!options.rowCount || !options.colCount) && !options.serialized) {
			throw new Error("Must specify # of rows and cols, or a serialized grid.");
		}
		const splitSerial = options.serialized?.split("\n");
		this.numRows = options.rowCount || splitSerial!.length;
		this.numCols = options.colCount || splitSerial![0].length;
		this.fillWith = options.fillWith ?? DEFAULT_FILL;

		if (options.serialized) {
			this.setFromSerialized(options.serialized);
		} else {
			this.initBlankGrid(options.fillWith);
		}
	}

	/**
	 * Number of rows in this grid.
	 */
	public get rowCount() {
		return this.numRows;
	}

	/**
	 * Number of columns in this grid.
	 */
	public get colCount() {
		return this.numCols;
	}

	/**
	 * Clears all of the grid's data and fills it with the
	 * given character.
	 * @param fillWith Character to fill the grid with. Defaults to a space.
	 */
	public initBlankGrid(fillWith?: string | undefined) {
		const sigil = fillWith ?? this.fillWith;
		this.ensureSigilRegistered(sigil);
		this.grid = [];
		for (const i of _.range(this.numRows)) {
			this.grid.push([]);
			for (const j of _.range(this.numCols)) {
				this.grid[i][j] = sigil;
			}
		}
	}

	/**
	 * Clears all of the grid's data and fills it with the given serialized grid.
	 * Defaults to updating the grid's dimensions to the given serialized grid's dimensions.
	 * @param serialized
	 * @param updateDimensions
	 */
	public setFromSerialized(serialized: string, updateDimensions: boolean = true) {
		const serialRows = serialized.split("\n");

		if (updateDimensions) {
			this.numRows = serialRows.length;
			this.numCols = serialRows[0].length;
		}

		this.initBlankGrid(this.fillWith);

		for (let i = 0; i < serialRows.length; ++i) {
			for (let j = 0; j < serialRows[0].length; ++j) {
				this.setCell([i, j], serialRows[i][j]);
			}
		}
	}

	private getSigilColor(sigil: string) {
		if (sigil === ".") {
			return chalk.gray;
		} else {
			return COLOR_ORDER[this.sigilStats[sigil].colorIndex];
		}
	}

	private ensureSigilRegistered(sigil: string) {
		if (!this.sigilStats[sigil]) {
			this.sigilStats[sigil] = { count: 0, colorIndex: this.nextColor++ % COLOR_ORDER.length };
			if (sigil === " ") {
				// don't advance color for spaces
				this.nextColor--;
			}
		}
	}

	/**
	 * Start queueing all subsequent updates to grid cell values. Do not
	 * update the grid until commit() is called. This is useful when you need
	 * to edit cells based on their surroundings, but not commit any changes
	 * until each cell has been visited (e.g. game of life).
	 */
	public batchUpdates() {
		if (this.batchUpdatedGrid != undefined) {
			throw new Error("Already batch updating. Must commit those changes first.");
		}
		this.batchUpdatedGrid = new Grid({ serialized: this.toString() });
	}

	/**
	 * Commit all queued changes from batchUpdates(). Further batched updates will
	 * require another call to batchUpdates().
	 */
	public commit() {
		if (this.batchUpdatedGrid == undefined) {
			throw new Error("Have not called batchUpdates().");
		}
		for (const cell of this.batchUpdatedGrid) {
			this.setCell(cell.position, cell.value, true);
		}
		this.batchUpdatedGrid = undefined;
	}

	/**
	 * Returns a grid AS IF all current batched updates were applied.
	 * Any mutations made to this grid WILL be committed next time
	 * commit() is called! If you need a copy, use copyGrid().
	 */
	public peekBatchedUpdates() {
		if (this.batchUpdatedGrid == undefined) {
			throw new Error("Have not called batchUpdates().");
		}
		return this.batchUpdatedGrid;
	}

	/**
	 * Discard all batched updates without committing to the grid.
	 */
	public rollback() {
		this.batchUpdatedGrid = undefined;
	}

	/**
	 * Set the value of a cell.
	 * @param pos The position of the cell to set the value of
	 * @param val A single character string value of the cell
	 * @param ignoreBatch If true, bypass the batched updates
	 * queue and set the value directly on the grid.
	 */
	public setCell(pos: GridPos, val: string, ignoreBatch = false) {
		if (this.batchUpdatedGrid && !ignoreBatch) {
			this.batchUpdatedGrid.setCell(pos, val);
		} else {
			this.grid[pos[0]][pos[1]] = val;
			this.ensureSigilRegistered(val);
		}
	}

	/**
	 * Get a single cell based on a criterion. If multiple cells match, get the first.
	 * @param input Can be one of:
	 *   GridPos: identifies a single cell based on its row and column
	 *    string: the value of the cell
	 *  Function: a predicate that is called on each cell in order.
	 * @param track If true, the grid will maintain a reference to this cell and automatically
	 * update it when the grid is updated. If null, return any tracked cell if it exists,
	 * otherwise create a new one. If false, always return a new cell object and don't track it.
	 */
	public getCell(input: GridPos | string | ((cell: Cell) => boolean), track: boolean | null = false) {
		let result: Cell | undefined = undefined;
		if (typeof input === "string") {
			for (const cell of this) {
				if (cell.value === input) {
					result = cell;
				}
			}
		} else if (typeof input === "function") {
			for (const cell of this) {
				if (input(cell)) {
					result = cell;
				}
			}
		} else {
			if (this.grid[input[0]] != undefined && this.grid[input[0]][input[1]] != undefined) {
				result = new Cell(this, input, this.getValue(input));
			}
		}
		if (result) {
			const resultCellKey = result.position.join(",");
			if (this.trackedCells.has(resultCellKey) && track !== false) {
				return this.trackedCells.get(resultCellKey);
			} else {
				if (track === true) {
					this.trackCell(result);
				}
			}
		}
		return result;
	}

	/**
	 * Have the grid maintain a reference to this cell so that the cell is automatically
	 * updated when the grid is updated. For example, if editGrid() is called, the cell's
	 * position will be updated to reflect the new position of the cell.
	 * @param cell
	 */
	public trackCell(cell: Cell) {
		this.trackedCells.set(cell.position.join(","), cell);
	}

	/**
	 * Stop the grid from tracking the given cell.
	 */
	public untrackCell(cell: Cell) {
		return this.trackedCells.delete(cell.position.join(","));
	}

	/**
	 * Returns true if the grid is currently tracking this cell.
	 * @param cell
	 */
	public isTracked(cell: Cell) {
		return this.trackedCells.has(cell.position.join(","));
	}

	/**
	 * Get an array of cells based on a criterion.
	 * @param input Can be one of:
	 *   GridPos[]: List of grid positions of cells to return
	 *      string: the value of the cell.
	 *    Function: a predicate that is called on each cell in order.
	 */
	public getCells(input: GridPos[] | string | ((cell: Cell) => boolean)) {
		const result: Cell[] = [];
		if (typeof input === "string") {
			for (const cell of this) {
				if (cell.value === input) {
					result.push(cell);
				}
			}
			return result;
		} else if (typeof input === "function") {
			for (const cell of this) {
				if (input(cell)) {
					result.push(cell);
				}
			}
			return result;
		} else {
			for (const pos of input) {
				if (this.grid[pos[0]] != undefined && this.grid[pos[0]][1] != undefined) {
					result.push(new Cell(this, pos, this.getValue(pos)));
				}
			}
			return result;
		}
	}

	/**
	 * Copy a grid to a new grid. Defaults to making an identical copy.
	 * @param options See CopyGridOptions for details.
	 */
	public copyGrid(options?: CopyGridOptions) {
		const _options = options ?? {};
		const srcStartRow = _options.srcStartRow ?? 0;
		const srcStartCol = _options.srcStartCol ?? 0;
		const srcEndRow = _options.srcEndRow ?? this.rowCount - 1; // srcStartRow + srcRowCount - 1;
		const srcEndCol = _options.srcEndCol ?? this.colCount - 1; // srcStartCol + srcColCount - 1;
		const srcRowCount = _options.srcRowCount ?? srcEndRow - srcStartRow + 1;
		const srcColCount = _options.srcColCount ?? srcEndCol - srcStartCol + 1;
		const destRowCount = _options.destRowCount ?? srcRowCount;
		const destColCount = _options.destColCount ?? srcColCount;
		const destStartRow = _options.destStartRow ?? 0;
		const destStartCol = _options.destStartCol ?? 0;

		const subgrid = new Grid({
			rowCount: destRowCount,
			colCount: destColCount,
			fillWith: options?.fillNewCellsWith ?? this.fillWith,
		});
		if (_options.copyValues !== false) {
			for (let i = srcStartRow; i < srcStartRow + srcRowCount; ++i) {
				for (let j = srcStartCol; j < srcStartCol + srcColCount; ++j) {
					subgrid.setCell(
						[i - srcStartRow + destStartRow, j - srcStartCol + destStartCol],
						this.getValue([i, j])
					);
				}
			}
		}
		return subgrid;
	}

	public editGrid(options: EditGridOptions) {
		this.editTop(options);
		this.editBottom(options);
		this.editLeft(options);
		this.editRight(options);
	}

	private reconcileTrackedCells() {
		const newTrackedCells = new Map<string, Cell>();
		for (const cell of this.trackedCells.values()) {
			newTrackedCells.set(cell.position.join(","), cell);
		}
		this.trackedCells = newTrackedCells;
	}

	private editTop(options: Pick<EditGridOptions, "top" | "fillWith">) {
		const { top = 0, fillWith = this.fillWith } = options;
		if (top + this.numRows < 0) {
			throw new Error("Cannot remove more rows than exist in the grid.");
		}
		this.numRows += top;
		this.ensureSigilRegistered(fillWith);
		if (top < 0) {
			this.grid.splice(0, -top);
		}
		if (top > 0) {
			for (let i = 0; i < top; ++i) {
				this.grid.unshift(Array(this.numCols).fill(fillWith));
			}
			// Update the row for any tracked cells
			for (const cell of this.trackedCells.values()) {
				cell.position[0] += top;
			}
			this.reconcileTrackedCells();
		}
	}

	private editBottom(options: Pick<EditGridOptions, "bottom" | "fillWith">) {
		const { bottom = 0, fillWith = this.fillWith } = options;
		if (bottom + this.numRows < 0) {
			throw new Error("Cannot remove more rows than exist in the grid.");
		}
		this.numRows += bottom;
		this.ensureSigilRegistered(fillWith);
		if (bottom < 0) {
			this.grid.splice(this.numRows + bottom, -bottom);
		}
		if (bottom > 0) {
			for (let i = 0; i < bottom; ++i) {
				this.grid.push(Array(this.numCols).fill(fillWith));
			}
		}
	}

	private editLeft(options: Pick<EditGridOptions, "left" | "fillWith">) {
		const { left = 0, fillWith = this.fillWith } = options;
		if (left + this.numCols < 0) {
			throw new Error("Cannot remove more columns than exist in the grid.");
		}
		this.numCols += left;
		this.ensureSigilRegistered(fillWith);
		if (left < 0) {
			for (let i = 0; i < this.numRows; ++i) {
				this.grid[i].splice(0, -left);
			}
		}
		if (left > 0) {
			for (let i = 0; i < this.numRows; ++i) {
				this.grid[i].unshift(...Array(left).fill(fillWith));
			}
			// Update the column for any tracked cells
			for (const cell of this.trackedCells.values()) {
				cell.position[1] += left;
			}
			this.reconcileTrackedCells();
		}
	}

	private editRight(options: Pick<EditGridOptions, "right" | "fillWith">) {
		const { right = 0, fillWith = this.fillWith } = options;
		if (right + this.numCols < 0) {
			throw new Error("Cannot remove more columns than exist in the grid.");
		}
		this.numCols += right;
		this.ensureSigilRegistered(fillWith);
		if (right < 0) {
			for (let i = 0; i < this.numRows; ++i) {
				this.grid[i].splice(this.numCols + right, -right);
			}
		}
		if (right > 0) {
			for (let i = 0; i < this.numRows; ++i) {
				this.grid[i].push(...Array(right).fill(fillWith));
			}
		}
	}

	public rotate(count = 1, direction: "CW" | "CCW" = "CW") {
		const rotateCount = (direction === "CCW" ? count * 3 : count) % 4;
		if (rotateCount === 0) {
			return this.copyGrid();
		}
		const keepDimensions = rotateCount % 2 === 0;
		const newGrid = new Grid({
			rowCount: keepDimensions ? this.rowCount : this.colCount,
			colCount: keepDimensions ? this.colCount : this.rowCount,
		});
		for (let i = 0; i < this.rowCount; ++i) {
			for (let j = 0; j < this.colCount; ++j) {
				if (rotateCount === 1) {
					newGrid.setCell([j, this.rowCount - i - 1], this.getValue([i, j]));
				} else if (rotateCount === 2) {
					newGrid.setCell([this.rowCount - i - 1, this.colCount - j - 1], this.getValue([i, j]));
				} else if (rotateCount === 3) {
					newGrid.setCell([this.colCount - j - 1, i], this.getValue([i, j]));
				}
			}
		}
		return newGrid;
	}

	public flip(direction: "horizontal" | "vertical" | "both") {
		const newGrid = new Grid({
			rowCount: this.rowCount,
			colCount: this.colCount,
		});
		const flipH = direction === "horizontal" || direction === "both";
		const flipV = direction === "vertical" || direction === "both";
		for (let i = 0; i < this.rowCount; ++i) {
			for (let j = 0; j < this.colCount; ++j) {
				newGrid.setCell(
					[flipV ? this.rowCount - i - 1 : i, flipH ? this.colCount - j - 1 : j],
					this.getValue([i, j])
				);
			}
		}
		return newGrid;
	}

	/**
	 * Simulate a cellular automaton with the given cell update function
	 * @param iterations      Number of iterations to run simulation, or a
	 *                        function that returns false when it is done.
	 * @param getNewCellValue The cell update function. Intended to update
	 *                        the value of the given cell only.
	 */
	public simulateCellularAutomata(
		iterations: number | ((grid: Grid, changesSinceLastIteration: boolean) => boolean),
		getNewCellValue: (cell: Cell, grid: Grid) => string | undefined
	) {
		let changes = true;
		for (let i = 0; typeof iterations === "number" ? i < iterations : iterations(this, changes); ++i) {
			this.batchUpdates();
			changes = false;
			for (const cell of this) {
				const newValue = getNewCellValue(cell, this);
				if (newValue && newValue !== cell.value) {
					cell.setValue(newValue);
					changes = true;
				}
			}
			this.commit();
		}
	}

	/**
	 * Gets the value of a single cell
	 * @param pos The position of the cell to get the value from
	 */
	public getValue(pos: GridPos) {
		return this.grid[pos[0]][pos[1]];
	}

	/**
	 * Serializes a grid to a flat string, rows separated by
	 * newline characters.
	 */
	public toString() {
		let str = "";
		for (let i = 0; i < this.grid.length; ++i) {
			for (let j = 0; j < this.grid[0].length; ++j) {
				str += this.grid[i][j];
			}
			if (i < this.grid.length - 1) {
				str += "\n";
			}
		}
		return str;
	}

	/**
	 * Logs a grid to the console with colored grid cell values
	 * @param printGridInfo If true, prints a line describing the
	 * number of rows and columns in the grid.
	 */
	public log(printGridInfo: boolean = true, cellToString?: (cell: Cell) => any) {
		if (printGridInfo) {
			console.log(`Grid with ${this.grid.length} rows and ${this.grid[0].length} columns.`);
		}
		for (let i = 0; i < this.grid.length; ++i) {
			for (let j = 0; j < this.grid[0].length; ++j) {
				if (typeof cellToString === "function") {
					const cell = this.getCell([i, j], null);
					if (cell) {
						const char = this.grid[i][j];
						const str = cellToString(cell) ?? this.getSigilColor(char)(char);
						process.stdout.write(String(str));
					}
				} else {
					const char = this.grid[i][j];
					process.stdout.write(this.getSigilColor(char)(char));
				}
			}
			process.stdout.write("\n");
		}
		console.log();
	}

	/**
	 * Iterate cell-by-cell in the grid, starting with the top-left cell, moving
	 * through the whole row before moving down to the next row.
	 */
	public [Symbol.iterator]() {
		let row = 0;
		let col = 0;
		const savedRows = this.numRows;
		const savedCols = this.numCols;

		return {
			next: (): IteratorResult<Cell, undefined> => {
				if (this.numRows !== savedRows || this.numCols !== savedCols) {
					throw new Error("Grid has changed shape since the last iteration.");
				}
				if (row >= this.numRows) {
					return { done: true, value: undefined };
				}
				const cell = new Cell(this, [row, col], this.getValue([row, col]));
				col++;
				if (col >= this.numCols) {
					col = 0;
					row++;
				}
				return {
					value: cell,
					done: false,
				};
			},
		};
	}
}

/**
 * Describes a Cell within a Grid. Please note the encapsulation relationship:
 * Cell contains a Grid member, not the other way around! Methods on the Cell
 * class are all convenience methods that call back to the parent grid. A Cell
 * is immutable! Its value is stored on the parent grid.
 */
export class Cell {
	private grid: Grid;
	private pos: GridPos;

	/**
	 * General purpose - attach any data you want to this cell. No type safety.
	 */
	public data: any = undefined;

	constructor(grid: Grid, pos: GridPos, value: string) {
		this.grid = grid;
		this.pos = pos;
	}

	/**
	 * Gets the value of the cell.
	 */
	public get value() {
		return this.grid.getValue(this.pos);
	}

	/**
	 * Gets the position of the cell.
	 */
	public get position() {
		return this.pos;
	}

	/**
	 * Gets the overall flat index of this cell. For example,
	 * the cell on the 2nd row in the first column of a grid with
	 * 10 columns will have an index of 10 (0-based).
	 */
	public get index() {
		return this.pos[0] * this.grid.colCount + this.pos[1];
	}

	// @todo fix the api for function sbelow
	/**
	 * Return the cell found `count` cells above of this cell.
	 * @param count Number of cells to move
	 * @param moveOption How to handle hitting the edge. @See MoveOption.
	 */
	public north(
		count: number | ((cell: Cell | undefined, origin: Cell) => boolean) = 1,
		moveOption: MoveOption = "none",
		options: Omit<RepeatMovementsOptions, "count" | "moveOption"> = {}
	) {
		return this.repeatMovements([Dir.N], { count, moveOption, ...options });
	}

	/**
	 * Return the cell found `count` cells right of this cell.
	 * @param count Number of cells to move
	 * @param moveOption How to handle hitting the edge. @See MoveOption.
	 */
	public east(
		count: number | ((cell: Cell | undefined, origin: Cell) => boolean) = 1,
		moveOption: MoveOption = "none",
		options: Omit<RepeatMovementsOptions, "count" | "moveOption"> = {}
	) {
		return this.repeatMovements([Dir.E], { count, moveOption, ...options });
	}

	/**
	 * Return the cell found `count` cells below of this cell.
	 * @param count Number of cells to move
	 * @param moveOption How to handle hitting the edge. @See MoveOption.
	 */
	public south(
		count: number | ((cell: Cell | undefined, origin: Cell) => boolean) = 1,
		moveOption: MoveOption = "none",
		options: Omit<RepeatMovementsOptions, "count" | "moveOption"> = {}
	) {
		return this.repeatMovements([Dir.S], { count, moveOption, ...options });
	}

	/**
	 * Return the cell found `count` cells left of this cell.
	 * @param count Number of cells to move
	 * @param moveOption How to handle hitting the edge. @See MoveOption.
	 */
	public west(
		count: number | ((cell: Cell | undefined, origin: Cell) => boolean) = 1,
		moveOption: MoveOption = "none",
		options: Omit<RepeatMovementsOptions, "count" | "moveOption"> = {}
	) {
		return this.repeatMovements([Dir.W], { count, moveOption, ...options });
	}

	/**
	 * Repeats the given list of movements several times to find a new cell.
	 * @param movements List of moves to make
	 * @param options Options for the movement
	 */
	public repeatMovements(movements: [dRow: number, dCol: number][], options: RepeatMovementsOptions = {}) {
		const { count = 1, moveOption = "none", forceOneMove = true, updateTracking = false, transferData } = options;
		let nextPos = [...this.pos] as GridPos;
		for (
			let i = 0;
			typeof count === "number"
				? i < count
				: (i === 0 && forceOneMove) || count(this.grid.getCell(nextPos), this);
			++i
		) {
			let lastValidCell: Cell = this;
			for (const movement of movements) {
				nextPos[0] += movement[0];
				nextPos[1] += movement[1];
				const landedOn = this.grid.getCell(nextPos);
				if (landedOn) {
					lastValidCell = landedOn;
				}
			}
			if (moveOption === "wrap") {
				nextPos[0] = util.mod(nextPos[0], this.grid.rowCount);
				nextPos[1] = util.mod(nextPos[1], this.grid.colCount);
			} else if (moveOption === "stay") {
				const prev = [...nextPos];
				nextPos[0] = util.clamp(nextPos[0], 0, this.grid.rowCount - 1);
				nextPos[1] = util.clamp(nextPos[1], 0, this.grid.colCount - 1);
				if (nextPos[0] !== prev[0] || nextPos[1] !== prev[1]) {
					nextPos[0] = lastValidCell.pos[0];
					nextPos[1] = lastValidCell.pos[1];
					break;
				}
			} else if (moveOption === "expand") {
				if (nextPos[0] < 0) {
					this.grid.editGrid({ top: -nextPos[0] });
					nextPos[0] = 0;
				}
				if (nextPos[1] < 0) {
					this.grid.editGrid({ left: -nextPos[1] });
					nextPos[1] = 0;
				}
				if (nextPos[0] >= this.grid.rowCount) {
					this.grid.editGrid({ bottom: nextPos[0] - this.grid.rowCount + 1 });
					nextPos[0] = this.grid.rowCount - 1;
				}
				if (nextPos[1] >= this.grid.colCount) {
					this.grid.editGrid({ right: nextPos[1] - this.grid.colCount + 1 });
					nextPos[1] = this.grid.colCount - 1;
				}
			} else if (typeof moveOption === "function") {
				const result = moveOption(this.grid.getCell(nextPos), this);
				if (result) {
					nextPos = result;
				}
			}
		}
		const result = this.grid.getCell(nextPos, null);
		if (updateTracking && result && this.grid.isTracked(this)) {
			this.grid.untrackCell(this);
			this.grid.trackCell(result);
		}
		if (transferData && result) {
			result.data = this.data;
			this.data = undefined;
		}
		return result;
	}

	/**
	 * Get an array of this cell's neighbors. Internal cells have four
	 * neighbors, while edge cells have three, and corner cells have two.
	 * @param includeDiagonals Also include the 4 diagonal neighbors.
	 */
	public neighbors(includeDiagonals = false, includeSelf = false) {
		const self = includeSelf ? this : undefined;
		if (includeDiagonals) {
			return [
				this.north(),
				this.north()?.east(),
				this.east(),
				this.south()?.east(),
				this.south(),
				this.south()?.west(),
				this.west(),
				this.north()?.west(),
				self,
			].filter(n => n != undefined) as Cell[];
		} else {
			return [this.north(), this.east(), this.south(), this.west(), self].filter(n => n != undefined) as Cell[];
		}
	}

	/**
	 * Returns true if this cell is on the top row of the grid.
	 */
	public isNorthEdge() {
		return this.north() == undefined;
	}

	/**
	 * Returns true if this cell is on the rightmost column of the grid.
	 */
	public isEastEdge() {
		return this.east() == undefined;
	}

	/**
	 * Returns true if this cell is last row of the grid.
	 */
	public isSouthEdge() {
		return this.south() == undefined;
	}

	/**
	 * Returns true if this cell is on the leftmost column of the grid.
	 */
	public isWestEdge() {
		return this.west() == undefined;
	}

	/**
	 * Returns true if the cell is in a corner of the grid.
	 */
	public isCorner() {
		return (
			(this.isNorthEdge() && this.isEastEdge()) ||
			(this.isNorthEdge() && this.isWestEdge()) ||
			(this.isSouthEdge() && this.isEastEdge()) ||
			(this.isSouthEdge() && this.isWestEdge())
		);
	}

	public isEqual(other: Cell | undefined) {
		return (
			other !== undefined &&
			this.position[0] === other.position[0] &&
			this.position[1] === other.position[1] &&
			this.grid === other.grid
		);
	}

	/**
	 * Set the value of this cell (calls to parent grid)
	 * @param val Single-character string value to set
	 */
	public setValue(val: string) {
		this.grid.setCell(this.pos, val);
	}

	/**
	 * Returns a string representation of this cell's position and value.
	 */
	public toString() {
		return `[${this.pos[0]}, ${this.pos[1]}]: ${this.value}`;
	}
}

if (require.main === module) {
	// run tests if this file is run directly.
	const myGrid = `..X..
@.#.$
.....
  &  
12345`;
	console.log(myGrid);
	const g = new Grid({ serialized: myGrid });
	g.log();
	let count = 0;
	for (const cell of g) {
		if (cell.value === ".") {
			count++;
		}
	}
	console.log(`dot count: ${count} (expect 11)`);
	const cellsThatHaveTwoDotNeighbors = Array.from(g).filter(
		c => c.neighbors(true).filter(n => n.value === ".").length === 2
	).length;
	console.log(`Num cells w/ 2 neighbors that are dots: ${cellsThatHaveTwoDotNeighbors} (expect 8)`);

	g.editGrid({ top: 2, fillWith: "!" });
	g.log();

	g.editGrid({ bottom: 2, fillWith: "!" });
	g.log();

	g.editGrid({ left: 2, fillWith: "!" });
	g.log();

	g.editGrid({ right: 2, fillWith: "!" });
	g.log();

	// Copy to new grid with 2 row/column thick border of empty cells.
	const borderSize = 2;
	const borderGrid = g.copyGrid({
		fillNewCellsWith: "#",
		destRowCount: g.rowCount + 2 * borderSize,
		destColCount: g.colCount + 2 * borderSize,
		destStartRow: borderSize,
		destStartCol: borderSize,
	});
	borderGrid.log();

	// Copy half of the grid to new grid, a few different ways
	const topHalf1 = g.copyGrid({
		srcRowCount: Math.floor(g.rowCount / 2),
	});
	topHalf1.log();

	const topHalf2 = g.copyGrid({
		srcEndRow: Math.floor(g.rowCount / 2),
	});
	topHalf2.log();

	const botHalf1 = g.copyGrid({
		srcStartRow: Math.floor(g.rowCount / 2),
	});
	botHalf1.log();

	const toRotate = new Grid({
		serialized: `1234
5678`,
	});
	toRotate.log(false);
	const rotate1 = toRotate.rotate(1);
	rotate1.log(false);
	const rotate2 = rotate1.rotate(1);
	rotate2.log(false);
	const rotate3 = rotate2.rotate(1);
	rotate3.log(false);
	const rotate4 = rotate3.rotate(1);
	rotate4.log(false);
	const hFlip = rotate4.flip("horizontal");
	hFlip.log(false);
	const vFlip = rotate4.flip("vertical");
	vFlip.log(false);
	const bothFlip = rotate4.flip("both");
	bothFlip.log(false);

	function conway(iterations: number = 100, rows: number = 30, cols: number = 50) {
		const g = new Grid({ rowCount: rows, colCount: cols, fillWith: "." });
		for (const cell of g) {
			if (Math.random() < 0.25) {
				cell.setValue("#");
			}
		}
		g.log();
		g.simulateCellularAutomata(iterations, cell => {
			const neighbors = cell.neighbors(true).filter(n => n.value === "#");
			if (cell.value === "#") {
				if (neighbors.length < 2 || neighbors.length > 3) {
					return ".";
				}
			} else if (cell.value === ".") {
				if (neighbors.length === 3) {
					return "#";
				}
			}
		});
		g.log();
	}
}
