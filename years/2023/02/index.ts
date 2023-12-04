import _ from "lodash";
import * as util from "../../../util/util";
import * as test from "../../../util/test";
import chalk from "chalk";
import { log, logSolution, trace } from "../../../util/log";
import { performance } from "perf_hooks";

const YEAR = 2023;
const DAY = 2;

// solution path: /home/chris/coding/advent-of-code/years/2023/02/index.ts
// data path    : /home/chris/coding/advent-of-code/years/2023/02/data.txt
// problem url  : https://adventofcode.com/2023/day/2

async function p2023day2_part1(input: string, ...params: any[]) {
	const lines = input.split("\n");
	let sum = 0;

	const RED_MAX = 12;
	const GREEN_MAX = 13;
	const BLUE_MAX = 14;

	for (const line of lines) {
		const gameTitle = line.split(":");
		const games = gameTitle[1].split(";");
		const gameNumber = gameTitle[0].match(/Game (\d+)/)?.[1];

		let possibleGame = true;
		for (const game of games) {
			const green = Number(game.match(/(\d+) green/)?.[1]);
			const blue = Number(game.match(/(\d+) blue/)?.[1]);
			const red = Number(game.match(/(\d+) red/)?.[1]);
			if (red > RED_MAX || green > GREEN_MAX || blue > BLUE_MAX) {
				possibleGame = false;
				break;
			}
		}
		if (possibleGame === true) {
			sum += Number(gameNumber);
		}
	}
	return sum;
}

async function p2023day2_part2(input: string, ...params: any[]) {
	const lines = input.split("\n");
	let sum = 0;

	const RED_MAX = 12;
	const GREEN_MAX = 13;
	const BLUE_MAX = 14;

	for (const line of lines) {
		const gameTitle = line.split(":");
		const games = gameTitle[1].split(";");
		const gameNumber = gameTitle[0].match(/Game (\d+)/)?.[1];
		var minRed = 0;
		var minGreen = 0;
		var minBlue = 0;

		for (const game of games) {
			const green = Number(game.match(/(\d+) green/)?.[1]);
			const blue = Number(game.match(/(\d+) blue/)?.[1]);
			const red = Number(game.match(/(\d+) red/)?.[1]);
			if (minRed <= red) {
				minRed = red;
			}
			if (minGreen <= green) {
				minGreen = green;
			}
			if (minBlue <= blue) {
				minBlue = blue;
			}
		}
		sum += minRed * minGreen * minBlue;
	}
	return sum;
}

async function run() {
	const part1tests: TestCase[] = [
		{
			input: `Game 1: 3 blue, 4 red; 1 red, 2 green, 6 blue; 2 green
			Game 2: 1 blue, 2 green; 3 green, 4 blue, 1 red; 1 green, 1 blue
			Game 3: 8 green, 6 blue, 20 red; 5 blue, 4 red, 13 green; 5 green, 1 red
			Game 4: 1 green, 3 red, 6 blue; 3 green, 6 red; 3 green, 15 blue, 14 red
			Game 5: 6 red, 1 blue, 3 green; 2 blue, 1 red, 2 green`,
			expected: `8`,
		},
	];
	const part2tests: TestCase[] = [
		{
			input: `Game 1: 3 blue, 4 red; 1 red, 2 green, 6 blue; 2 green
			Game 2: 1 blue, 2 green; 3 green, 4 blue, 1 red; 1 green, 1 blue
			Game 3: 8 green, 6 blue, 20 red; 5 blue, 4 red, 13 green; 5 green, 1 red
			Game 4: 1 green, 3 red, 6 blue; 3 green, 6 red; 3 green, 15 blue, 14 red
			Game 5: 6 red, 1 blue, 3 green; 2 blue, 1 red, 2 green`,
			expected: `2286`,
		},
	];

	// Run tests
	test.beginTests();
	await test.section(async () => {
		for (const testCase of part1tests) {
			test.logTestResult(testCase, String(await p2023day2_part1(testCase.input, ...(testCase.extraArgs || []))));
		}
	});
	await test.section(async () => {
		for (const testCase of part2tests) {
			test.logTestResult(testCase, String(await p2023day2_part2(testCase.input, ...(testCase.extraArgs || []))));
		}
	});
	test.endTests();

	// Get input and run program while measuring performance
	const input = await util.getInput(DAY, YEAR);

	const part1Before = performance.now();
	const part1Solution = String(await p2023day2_part1(input));
	const part1After = performance.now();

	const part2Before = performance.now();
	const part2Solution = String(await p2023day2_part2(input));
	const part2After = performance.now();

	logSolution(2, 2023, part1Solution, part2Solution);

	log(chalk.gray("--- Performance ---"));
	log(chalk.gray(`Part 1: ${util.formatTime(part1After - part1Before)}`));
	log(chalk.gray(`Part 2: ${util.formatTime(part2After - part2Before)}`));
	log();
}

run()
	.then(() => {
		process.exit();
	})
	.catch(error => {
		throw error;
	});
