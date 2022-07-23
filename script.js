let apiEndpoint = 'https://api.torn.com'

document.getElementById('submit').addEventListener('click', async () => {
    let apiKey = document.getElementById('api-key').value;

    // clear table
    document.getElementById('report-table-body').replaceChildren();

    // get user info
    let userInfo = await getUserInfo(apiKey);

    if ('error' in userInfo) {
        alert('Unable to get user info: ' + userInfo.error.error);
        return;
    }

    // get faction id
    let factionId = userInfo.faction.faction_id;

    if (factionId === 0) {
        alert('User does not have a faction');
        return;
    }

    // get faction info
    let factionInfo = await getFactionInfo(apiKey, factionId);

    if ('error' in factionInfo) {
        alert('Unable to fetch faction info: ' + factionInfo.error.error);
        return;
    }

    // pull war start time
    if (Object.keys(factionInfo.ranked_wars).length === 0) {
        alert('Unable to fetch ranked war info');
        return;
    }

    let warId = Object.keys(factionInfo.ranked_wars)[0];
    let startTime = factionInfo.ranked_wars[warId].war.start;
    let endTime = factionInfo.ranked_wars[warId].war.end;

    if (endTime !== 0) {
        endTime += 1;
    }

    // turn on spinner
    document.getElementById('spinner').style.display = 'block';

    let attackDictionary = {};

    // attacks API only returns 100 items, so we need to fetch in batches
    while (startTime < endTime || endTime === 0) {
        // pull attacks after start of war
        let attacks = await getAttacks(apiKey, factionId, startTime, endTime);

        if ('error' in attacks) {
            // turn off spinner
            document.getElementById('spinner').style.display = 'none';
            alert('Unable to fetch attacks: ' + attacks.error.error);
            return;
        }

        // unnest object
        attacks = attacks.attacks;

        console.log(attacks);
        console.log(Object.keys(attacks).length);

        // empty response - no further attacks
        if (Object.keys(attacks).length === 0) {
            break;
        }

        // time cutoff issue - only last attack in previous batch is returned
        if (Object.keys(attacks).length === 1 && Object.keys(attacks)[0] in attackDictionary) {
            break;
        }

        attackDictionary = Object.assign({}, attackDictionary, attacks);

        // get next batch of attacks
        let attackIds = Object.keys(attacks).sort();
        let lastAttackId = attackIds[attackIds.length - 1];
        startTime = attacks[lastAttackId].timestamp_started;

        if (startTime > endTime && endTime !== 0) {
            break;
        }

        // sleep for 30 seconds because Torn API caches responses >:(
        await sleep(30000);
    }

    // convert to list
    let attackList = Object.keys(attackDictionary).map(function (key) {
        return attackDictionary[key];
    });

    // filter for hits made by faction
    attackList = attackList.filter(item => item.attacker_faction === factionId);

    // filter for war hits only (ranked_war: 1)
    attackList = attackList.filter(item => item.ranked_war === 1);

    // aggregate data accordingly
    let attackStats = {};

    for (let attack of attackList) {
        if (!(attack.attacker_id in attackStats)) {
            attackStats[attack.attacker_id] = {
                Member: attack.attacker_name,
                Attacked: 0,
                Mugged: 0,
                Hospitalized: 0,
                Assist: 0,
                Stalemate: 0,
                Escape: 0,
                Lost: 0,
                Respect: 0
            };
        }

        if (!(attack.result in attackStats[attack.attacker_id])) {
            // not sure what special is, but looks like leave
            if (attack.result === 'Special') {
                attackStats[attack.attacker_id]['Attacked'] += 1;
                attackStats[attack.attacker_id]['Respect'] += attack.respect;
            } else {
                console.log(attack);
            }

            continue;
        }

        attackStats[attack.attacker_id][attack.result] += 1;
        attackStats[attack.attacker_id]['Respect'] += attack.respect;
    }

    // sort by respect earned
    let attackStatsList = Object.keys(attackStats).map(function (key) {
        return attackStats[key];
    });

    attackStatsList.sort(function (a, b) { return b.Respect - a.Respect });

    // update table
    for (let attackStat of attackStatsList) {
        let attackStatRow = document.getElementById('report-table-body').insertRow();

        // Member column
        attackStatRow.insertCell().appendChild(document.createTextNode(attackStat['Member']))

        // Attacks column
        attackStatRow.insertCell().appendChild(document.createTextNode(attackStat['Attacked'] + attackStat['Mugged'] + attackStat['Hospitalized']));

        // Leave column - note API calls it "Attacked"
        attackStatRow.insertCell().appendChild(document.createTextNode(attackStat['Attacked']));

        // Mug column
        attackStatRow.insertCell().appendChild(document.createTextNode(attackStat['Mugged']));

        // Hosp column
        attackStatRow.insertCell().appendChild(document.createTextNode(attackStat['Hospitalized']));

        // Assist column
        attackStatRow.insertCell().appendChild(document.createTextNode(attackStat['Assist']));

        // Draw column - note API calls it "Stalemate"
        attackStatRow.insertCell().appendChild(document.createTextNode(attackStat['Stalemate']));

        // Escape column
        attackStatRow.insertCell().appendChild(document.createTextNode(attackStat['Escape']));

        // Loss column - note API calls it "Lost"
        attackStatRow.insertCell().appendChild(document.createTextNode(attackStat['Lost']));

        // Respect column
        attackStatRow.insertCell().appendChild(document.createTextNode(attackStat['Respect'].toFixed(2)));
    }

    // turn off spinner
    document.getElementById('spinner').style.display = 'none';
});

async function getUserInfo(apiKey) {
    url = 'https://api.torn.com/user?' + new URLSearchParams({ selections: 'profile', key: apiKey });
    return await fetch(url).then(response => response.json());
}

async function getFactionInfo(apiKey, factionId) {
    url = constructUrl(apiKey, factionId, 'basic');
    return await fetch(url).then(response => response.json());
}

async function getAttacks(apiKey, factionId, startTime, endTime) {
    url = constructUrl(apiKey, factionId, 'attacks', startTime, endTime);
    return await fetch(url).then(response => response.json());
}

function constructUrl(apiKey, factionId, selection, startTime, endTime) {
    let baseUrl = [apiEndpoint, 'faction', factionId].join('/');
    return baseUrl + '?' + new URLSearchParams({ selections: selection, key: apiKey, from: startTime, to: endTime });
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
