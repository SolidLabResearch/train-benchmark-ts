import {QueryRunner} from "../lib/QueryRunner";
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import {BenchmarkConfig} from "../lib/Types";
import {Worker, isMainThread, parentPort, workerData} from 'worker_threads';

function getJoinConfigPath(basePathName: string, joinName: string) {
  switch (joinName) {
    case "computational-bind-join":
      return basePathName + "computational-bind-join/engine.js";
    case "delta-query":
      return basePathName + "delta-query/engine.js";
    case "full-hash-join":
      return basePathName + "full-hash-join/engine.js";
    case "memory-bind-join":
      return basePathName + "memory-bind-join/engine.js";
    case "nestedloop-join":
      return basePathName + "nestedloop-join/engine.js";
    case "partial-match-hash-join":
      return basePathName + "partial-match-hash-join/engine.js";
    case "partial-delete-hash-join":
      return basePathName + "partial-delete-hash-join/engine.js";
  }
  throw new Error(`join algorithm: ${joinName} doesn't exist`);
}

async function run(): Promise<void> {
  if (isMainThread) {
    let timeOutLengthMinutes = 1;
    //get config from file
    let benchmarkConfigsFilePath: string = "";
    for (let i = 0; i < process.argv.length; i++) {
      if (process.argv[i] === "-f") {
        benchmarkConfigsFilePath = process.argv[i+1];
        break;
      }
    }
    if (benchmarkConfigsFilePath === "") throw new Error('benchmarkConfigsFilePath not specified, add -f tag!');

    let benchmarkFile = await new Promise<any>((resolve, reject) => {
      fs.readFile(
        benchmarkConfigsFilePath,
        'utf8',
        (error, data) => {
          if(error){
            reject(error);
          }
          try {
            resolve(JSON.parse(data));
          } catch (error) {
            reject(error);
          }
        });
    });

    for (const configFile of benchmarkFile.benchmarkConfigs) {
      if (typeof configFile.joinAlgorithm === 'string') {
        configFile.joinAlgorithm = [configFile.joinAlgorithm];
      }
      if (typeof configFile.dataPath === 'string') {
        configFile.dataPath = [configFile.dataPath];
      }
      if (typeof configFile.operationStrings[0] === 'string') {
        configFile.operationStrings = [configFile.operationStrings];
      }
      for (const joinAlgorithm of configFile.joinAlgorithm) {
        for (const dataPath of configFile.dataPath) {
          for (const operationStrings of configFile.operationStrings) {
            let configFileName = joinAlgorithm + "_" + new Date().toUTCString() + "-" + new Date().getSeconds() + "," + new Date().getMilliseconds() + ".json";

            let resultPath = benchmarkFile.commonConfig.baseResultPath + uuidv4() + ".csv";

            let benchmarkConfig: BenchmarkConfig = {
              matchTransformPercentage: configFile.matchTransformPercentage,
              matchTransformAmount: configFile.matchTransformAmount,
              randomSeed: benchmarkFile.commonConfig.randomSeed,
              queryEngineConfig: getJoinConfigPath(benchmarkFile.commonConfig.baseIncremunicaConfigPath, joinAlgorithm),
              dataPath: dataPath,
              operationStrings: operationStrings,
              resultsPath: resultPath,
              cachedResultsBasePath: benchmarkFile.commonConfig.baseIncremunicaConfigPath.split('/').slice(0, -2).join('/') + "/cachedResults/",
              numberOfTransforms: configFile.numberOfTransforms,
              runNr: -1
            };

            //save benchmark config
            try {
              fs.mkdirSync(benchmarkFile.commonConfig.baseConfigPath)
            } catch (e) {
            }
            fs.writeFileSync(benchmarkFile.commonConfig.baseConfigPath + configFileName, JSON.stringify(benchmarkConfig));

            try {
              fs.rmSync(benchmarkFile.commonConfig.baseConfigPath + 'latest', {recursive: true})
            } catch (e) {
            }
            try {
              fs.mkdirSync(benchmarkFile.commonConfig.baseConfigPath + 'latest')
            } catch (e) {
            }
            fs.writeFileSync(benchmarkFile.commonConfig.baseConfigPath + 'latest/' + configFileName, JSON.stringify(benchmarkConfig, undefined, "\n"));

            try {
              fs.mkdirSync(benchmarkFile.commonConfig.baseResultPath)
            } catch (e) {
            }
            fs.writeFileSync(resultPath, QueryRunner.BuildCSVHeader(benchmarkConfig));

            let timedOut = false;
            //warmupRound
            try {
              const worker = new Worker(__filename, {
                workerData: benchmarkConfig
              });

              let timeout = setTimeout(() => {
                worker.terminate();
                console.log("timeout");
                timedOut = true;
              }, timeOutLengthMinutes * 60000);

              await new Promise<void>((resolve, reject) => {
                worker.once('message', () => {
                  resolve();
                })
                worker.on("error", (err: any) => {
                  reject(err);
                });
                worker.on("exit", () => {
                  resolve();
                });
              });
              clearTimeout(timeout);
            } catch (e) {
              console.log(e);
              continue;
            }

            if (timedOut) {
              continue;
            }

            for (let i = 0; i < configFile.numberOfRuns; i++) {
              try {
                benchmarkConfig.runNr = i;

                const worker = new Worker(__filename, {
                  workerData: benchmarkConfig,
                });

                await new Promise<void>((resolve, reject) => {
                  worker.once('message', () => {
                    resolve();
                  })
                  worker.on("error", (err: any) => {
                    reject(err);
                  });
                  worker.on("exit", () => {
                    resolve();
                  });
                });
              } catch (e) {
                console.log(e);
              }
            }
          }
        }
      }
    }
  } else {
    console.log('Run');
    Error.stackTraceLimit = 0;

    let benchmarkConfig: BenchmarkConfig = workerData;
    console.log(JSON.stringify(benchmarkConfig));

    const queryRunner = await QueryRunner.setupQueryRunner(benchmarkConfig);

    await queryRunner.run();

    if (parentPort === null) throw new Error('parentPort is null');
    parentPort.postMessage('');
    console.log('done');
    process.exit();
  }
}

run().then(() => {
  console.log('Benchmark finished');
}).catch(error => {
  throw error;
});
