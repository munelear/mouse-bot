const fuzzy = require("fuzzy-predicate");
const requiredCharacters = require("./common-characters.js");
const requiredShips = require("./common-ships.js");

const shardsRemainingAtStarLevel = {
    0: 330,
    1: 320,
    2: 305,
    3: 280,
    4: 250,
    5: 185,
    6: 100,
    7: 0
};

module.exports = function(characterCollection, shipCollection, charactersData, shipsData) {
    const collectionIterator = function(requiredUnits, unitData, playerCollection) {
        const responseObject = {
            "deficientUnits" : [],
            "inactiveUnits" : [],
            "totalAcquiredShards" : 0,
            "totalRequiredShards" : 0
        };

        requiredUnits.forEach(unit => {
            const lookup = unitData.filter(fuzzy(unit.name, ["name", "nickname"]));
            if (!lookup) console.log("I couldn't find: " + unit.name);
            if (lookup.length > 1) console.log("I found too many matches for: " + unit.name);

            const foundCharacter = playerCollection.find(c => (c.description.trim()) === lookup[0].name);
            const rank = (foundCharacter) ? Number(foundCharacter.star) : 0;

            if (rank < unit.stars) {
                responseObject.totalRequiredShards += shardsRemainingAtStarLevel[0] - shardsRemainingAtStarLevel[unit.stars];
                responseObject.totalAcquiredShards += shardsRemainingAtStarLevel[0] - shardsRemainingAtStarLevel[rank];
                if (foundCharacter && rank) {
                    responseObject.deficientUnits.push(`${foundCharacter.star}* ${foundCharacter.level}-g${foundCharacter.gearLevel} (${foundCharacter.galacticPower}) - ${(foundCharacter.description).trim()}`);
                } else {
                    responseObject.inactiveUnits.push(`${lookup[0].name}`);
                }
            } else {
                // so we don't get % completions over 100, cap the acquired at the required level
                responseObject.totalRequiredShards += shardsRemainingAtStarLevel[0] - shardsRemainingAtStarLevel[unit.stars];
                responseObject.totalAcquiredShards += shardsRemainingAtStarLevel[0] - shardsRemainingAtStarLevel[unit.stars];
            }
        });

        return responseObject;
    };


    const characterStatus = collectionIterator(requiredCharacters, charactersData, characterCollection);
    const shipStatus = collectionIterator(requiredShips, shipsData, shipCollection);

    const totalProgress = (((characterStatus.totalAcquiredShards + shipStatus.totalAcquiredShards) /
        (characterStatus.totalRequiredShards + shipStatus.totalRequiredShards)) * 100).toFixed(1);

    return {
        "characterStatus" : characterStatus,
        "shipStatus" : shipStatus,
        "totalProgress" : totalProgress
    };
};
