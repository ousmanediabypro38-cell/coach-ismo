// Routine officielle U13 CTC : « un exercice, plusieurs objectifs » (tes notes du 19/11/2026 + la vidéo « The Only Warm-Up Drill Your Youth Basketball Team Needs »).
// Les schémas sont dessinés sur le demi-terrain (panier en haut, droite = ta droite quand tu regardes le panier) : tu peux les modifier dans l'éditeur.
(function () {
  const O = (n, x, y) => ({ t: "o", n, x, y }), X = (n, x, y) => ({ t: "x", n, x, y }), B = (x, y) => ({ t: "b", x, y });
  const P = (x, y) => ({ t: "txt", x, y, s: "▲" }), T = (x, y, s) => ({ t: "txt", x, y, s });
  const mv = p => ({ t: "move", p }), dr = p => ({ t: "dribble", p }), ps = p => ({ t: "pass", p });
  // ---- Exercice 1 : finition sur coupe
  const ex1 = [O(1, 409, 211), B(393, 222), O(2, 432, 252), O(3, 250, 100), O(4, 91, 211), P(350, 130), P(112, 168),
    dr([[409, 211], [432, 150], [400, 92], [338, 74]]), mv([[91, 211], [160, 160], [222, 112]]), ps([[345, 80], [262, 104]]), T(110, 258, "coupeur")];
  const ex1b = [O(1, 409, 211), O(2, 432, 252), O(3, 250, 100), O(4, 91, 211), P(300, 160), P(190, 168), T(300, 150, ""),
    dr([[409, 211], [370, 150], [330, 110], [300, 95]]), mv([[91, 211], [60, 120], [70, 40]]), ps([[320, 100], [90, 70]]), T(60, 190, "backdoor")];
  // ---- Exercice 2 : slalom de dribbles
  const ex2 = [O(1, 409, 211), B(393, 222), O(2, 432, 252), O(3, 250, 100), O(4, 91, 211), P(420, 178), P(390, 140), P(425, 104), P(95, 170),
    dr([[409, 211], [392, 190], [440, 160], [372, 135], [445, 108], [360, 72]]), mv([[91, 211], [168, 196], [226, 118]]), ps([[352, 78], [240, 112]]), T(80, 250, "par l'elbow")];
  // ---- Exercice 3 : catch and shoot
  const ex3 = [O(1, 409, 211), B(393, 222), O(2, 432, 252), O(3, 250, 100), O(4, 150, 300), P(112, 255),
    dr([[409, 211], [432, 150], [400, 92], [338, 74]]), mv([[150, 300], [100, 280], [88, 225]]), ps([[345, 90], [100, 212]]), T(50, 205, "tir")];
  // ---- Exercice 5 : avec un défenseur
  const ex5 = [O(1, 409, 211), B(393, 222), O(2, 432, 252), O(3, 250, 100), O(4, 91, 211), X(1, 360, 160), P(350, 130),
    dr([[409, 211], [385, 175], [345, 135]]), mv([[91, 211], [160, 160], [222, 112]]), T(300, 200, "défenseur"), T(120, 258, "pied dans la raquette = passe")];
  // ---- Exercice 7 : close-outs en carré
  const ex7 = [X(1, 168, 12), X(2, 331, 12), X(3, 168, 193), X(4, 331, 193), O(1, 58, 64), O(2, 442, 64), O(3, 91, 232), O(4, 409, 232),
    mv([[168, 12], [100, 55]]), mv([[331, 12], [400, 55]]), mv([[168, 193], [112, 222]]), mv([[331, 193], [388, 222]]), T(190, 112, "1. signal : mains"), T(160, 345, "2. close-out contrôlé")];

  window.RoutineModelU13 = {
    key: "u13ctc", official: true, name: "Routine U13 CTC · un exercice, plusieurs objectifs", source: "Routine officielle U13 CTC",
    notes: "Un seul exercice d'échauffement, sans défenseur au départ : on change l'objectif en déplaçant 2 plots et les joueurs. Base : tes notes du 19/11/2026 complétées avec la vidéo « The Only Warm-Up Drill Your Youth Basketball Team Needs ». Ajoute la partie articulaire plus tard avec « Ajouter un bloc ».",
    blocks: [
      { key: "u13-base", title: "Le principe : mise en place, rotations, axes techniques", duration: "", items: [], body: `## Mise en place commune
- Une colonne de joueurs avec ballon, un rebondeur sous le panier, un joueur sans ballon et 2 plots.
- Dans tes notes, la colonne part de l'aile à 45° côté droit. Dans la vidéo, elle part de la ligne médiane, côté droit.
## Rotations (communes à tous les exercices)
1. Le joueur porteur de balle continue sa course vers l'aile à 45° et prend la place du coupeur.
2. Le joueur qui a tiré devient rebondeur.
3. Le rebondeur prend le ballon et va dans la colonne avec balle.
## Axes techniques (communs)
- Haute intensité pour un bon tempo.
- Bon timing de passe.
- Libre sur la finition et sur la passe : les joueurs s'adaptent au monde dans la raquette et aux vitesses différentes.
- Changement de rythme.
- Le passeur ne s'arrête jamais après sa passe : on enchaîne la rotation pour avoir le moins d'arrêt possible.` },
      { key: "u13-ex1", title: "Exercice 1 : finition sur coupe (la base)", duration: "", items: [], diagrams: [{ title: "Base : finition sur coupe", note: "Le porteur drive vers la ligne de fond, passe sous le plot et repart vers le panier. Le coupeur vient vers le cœur de la raquette et reçoit la passe en course.", items: ex1 }, { title: "Variante : backdoor", note: "2 plots déplacés : le porteur drive au milieu et passe à un joueur qui fait un backdoor depuis le corner.", items: ex1b }], body: `## Mise en place
- Une colonne avec ballon à l'aile à 45° côté droit. Un rebondeur sous le panier.
- Un joueur sans ballon collé à la ligne à 3 points, à 45° côté gauche.
- Un plot aux alentours de la raquette (la « box »), côté droit. Un plot devant le joueur à 45° côté gauche.
## Déroulement
1. Le premier joueur avec ballon drive en direction de la ligne de fond, passe sous le plot et repart vers le panier.
2. Dans le même temps, le joueur sans ballon coupe de son poste, à l'aile, vers le cœur de la raquette.
3. Le porteur de balle passe dans la course au joueur sans ballon, qui entame la finition.
## Variantes (tes notes)
- **Plots déplacés** : le plot du 45° gauche va dans le short corner, celui de la raquette passe à 85° de la ligne à 3 points.
- **Drive et recul** : le porteur drive devant lui pour faire passer son défenseur sous la ligne à 3 points, dribble de recul, puis attaque par l'axe, à l'extérieur du plot. Dans le même temps, le joueur sans ballon fait un backdoor pour marquer sur la ligne de fond.
## Variantes (vidéo)
- **Backdoor** : on déplace les 2 plots. Le porteur drive au milieu et passe à un joueur qui fait un backdoor depuis le corner. Le passeur continue vers le corner et devient le prochain coupeur backdoor, prêt à recevoir une passe pour un lay-up.
- **Drive de ligne de fond** : le joueur qui reçoit la balle dans le corner fait un drive de ligne de fond suivi d'un lay-up, au lieu de la coupe backdoor.
- **Rotation du « center » sur pénétration axiale** : on déplace encore les plots pour travailler ce mouvement (le rebondeur sous le panier est concerné).` },
      { key: "u13-ex2", title: "Exercice 2 : slalom de dribbles", duration: "", items: [], diagrams: [{ title: "Slalom de dribbles", note: "Le porteur fait le slalom avec crossovers, le coupeur passe par l'elbow, finition en 1 dribble maximum.", items: ex2 }], body: `## Mise en place
- Une colonne avec ballon à l'aile à 45° côté droit, poste arrière.
- Un rebondeur sous le panier.
- Un joueur sans ballon à 45° côté gauche, poste arrière.
- Trois plots en slalom côté droit, le dernier dans l'aile.
- Un plot à 80° devant le joueur à 45° côté gauche, poste arrière.
## Déroulement
1. Le joueur avec ballon fait le slalom de dribbles, avec différents crossovers.
2. Dans le même temps, le joueur sans ballon coupe de son poste vers la raquette en passant par l'elbow.
3. Le porteur passe dans la course au joueur sans ballon, qui entame la finition en 1 dribble maximum.
4. Après sa passe, le porteur contourne le plot et prend la place du coupeur.
5. Quand on entame la rotation, on enchaîne le jeu pour avoir le moins d'arrêt possible.
## Variantes (tes notes)
- **Carré de plots pour le porteur** : il fait le tour du carré en restant face à la ligne de fond.
- **Carré de plots pour le joueur sans ballon** : plus profond que celui du porteur, et cette fois il finit sur un jump shoot.
- **Parcours de 4 plots avec extra-passe** :
- Les 4 plots forment un slalom qui commence à 45° à 3 points et va jusqu'à la ligne des lancers francs, dans le prolongement de la raquette. Un 5e plot est placé dans les 3 points, à 45° opposé.
- Les porteurs de balle sont dans le corner gauche, le rebondeur sous le panier, et le joueur sans ballon est collé à la ligne à 3 points, dans le prolongement de la ligne des lancers francs.
- Le porteur commence son slalom. Avant d'arriver au 3e plot, il envoie une extra-passe au joueur opposé, qui est parti de sa position, a dépassé son plot par l'extérieur et vient de rentrer dans les 3 points : tir ou tir en course.
- Après sa passe, le porteur termine le slalom et va jusqu'à la position de 45° opposée, là où était son partenaire, car le 2e porteur, dans le corner, commence son slalom.
- Objectif : enchaîner sans pause.
## Variantes (vidéo)
- **Drive et dribble de recul** (idéal pour les plus jeunes) : drive de ligne de fond suivi d'un dribble de recul. La difficulté est de garder la tête haute pour bien timer la passe.
- **Tête haute dans le slalom** : le porteur passe la balle au moment exact où son coéquipier est prêt à tirer, puis il continue le slalom, contourne le plot et reçoit la passe suivante pour un tir. Le tireur reçoit la passe juste après avoir contourné le plot, prêt à attraper et tirer.` },
      { key: "u13-ex3", title: "Exercice 3 : tirs en catch and shoot", duration: "", items: [], diagrams: [{ title: "Catch and shoot", note: "Le tireur contourne un plot du côté opposé, reçoit la passe et tire tout de suite.", items: ex3 }], body: `Même exercice, mais la finition devient un tir.
## Déroulement
1. Le porteur drive en direction de la ligne de fond.
2. En même temps, le tireur contourne un plot du côté opposé et cherche un spot pour attraper et tirer.
3. Le porteur passe, le tireur tire. Le passeur devient le prochain tireur : on garde un enchaînement continu.
## Axes techniques spécifiques
- Le tireur reçoit la passe juste après avoir contourné le plot, prêt à attraper et tirer.
- Timing de passe : la balle part quand le tireur est prêt.
## Variantes (vidéo)
- **Tir à 3 points** : on ajoute un plot. Le tir se prend depuis l'aile ou le corner, n'importe quel spot, selon ta créativité.
- **Passe et coupe** : les joueurs partent du haut. Le joueur passe à l'aile droite, puis coupe dans la raquette vers l'autre côté, où il reçoit la passe du coéquipier suivant, placé à gauche. Les tirs alternent gauche et droite. Idéal pour apprendre à passer et couper.` },
      { key: "u13-ex4", title: "Exercice 4 : deux passes", duration: "", items: [], body: `On garde le drive de ligne de fond et la passe vers l'extérieur, et on ajoute une seconde passe pour insister sur la passe.
## Déroulement
1. Le porteur drive vers la ligne de fond et passe vers l'extérieur (kick-out).
2. Le passeur sort derrière la ligne à 3 points, puis coupe directement vers le panier pour un lay-up, sur une seconde passe.
3. À la place du rebondeur, 2 joueurs sont placés à l'aile. Le joueur qui vient de passer prend le rebond.
## À vérifier avec la vidéo (de 5:34 à 6:27)
- L'enchaînement exact de la seconde passe.
## Variante (vidéo)
- Drive de ligne de fond, kick-out, le passeur contourne un plot et revient vers le panier, pendant que le joueur 4 drive en ligne de fond et lui donne une passe pour un lay-up.` },
      { key: "u13-ex5", title: "Exercice 5 : avec un défenseur", duration: "", items: [], diagrams: [{ title: "Avec un défenseur", note: "Le défenseur empêche le porteur d'entrer dans la raquette. Le porteur ne passe que lorsqu'il a un pied dans la raquette.", items: ex5 }], body: `On peut ajouter un défenseur à toutes les variantes pour rendre l'exercice plus proche du match et plus difficile.
## Déroulement (version finition)
1. Le défenseur empêche le porteur d'entrer dans la raquette.
2. Le porteur ne peut passer que lorsqu'il a un pied dans la raquette.
3. Après la passe, l'attaquant et le défenseur sortent tous les deux derrière la ligne à 3 points. Peu importe l'endroit : là où ils pensent avoir un avantage.
4. Si le backdoor n'est pas possible, on joue un 1c1.
5. Le défenseur prend le rebond et va se placer à la ligne médiane.
6. Rotation des rôles : le passeur devient défenseur après sa passe, et l'attaquant devient passeur.
## Axes techniques spécifiques
- Apprendre à stopper la pénétration axiale.
- Le défenseur est plus à l'aise s'il force le porteur vers la ligne de fond.
- Si l'attaquant entre dans la raquette par l'axe, la distance jusqu'à la ligne à 3 points est plus courte.
## Variante tir (vidéo)
Idéal pour travailler les tirs contestés. La mise en place reste la même.
1. Dès que le porteur a un pied dans la raquette, il passe à son coéquipier pour un tir immédiat.
2. Le défenseur ferme (close-out) et conteste le tir.
3. Le défenseur prend le rebond, le tireur devient le prochain défenseur et le passeur devient le prochain tireur.` },
      { key: "u13-ex6", title: "Exercice 6 : version terrain entier (physique)", duration: "", items: [], body: `Même principe, avec les plots plus espacés pour que les joueurs courent de plus longues distances.
1. On place un joueur de plus hors limites, sur la ligne de touche.
2. Ce joueur part en courant dès que le rebondeur a le ballon.
3. Il reçoit une longue passe pour un lay-up de l'autre côté du terrain.
4. Le rebondeur prend la place sur la ligne de touche et devient le prochain coureur.
On garde le même enchaînement continu, avec des distances de course plus longues.` },
      { key: "u13-ex7", title: "Exercice 7 : défense, close-outs en carré", duration: "", items: [], diagrams: [{ title: "Close-out depuis la raquette : 4 défenseurs, 4 attaquants", note: "Départ en carré. 1. Signal : les 4 se touchent les mains. 2. Close-out contrôlé sur son attaquant. Il ferme l'axe et annonce « balle » très fort. À faire 2 fois, en changeant les rôles.", items: ex7 }], body: `Exercice purement défensif, en 2 parties. Il travaille le close-out contrôlé.
## Mise en place
- 4 défenseurs, un sur chacun des 4 coins de la raquette.
- 4 attaquants : 2 aux ailes et 2 dans les corners, de préférence avec un ballon.
## Partie 1 : close-out au signal
1. Les défenseurs se mettent en tapping (appuis rapides sur place).
2. Au signal du coach, les 4 se touchent les mains au milieu de la raquette.
3. Ils courent ensuite faire un close-out sur l'attaquant de leur zone.
4. On le fait 2 fois, à tour de rôles.
## Partie 2 : close-out, 3 dribbles et score
Les 4 défenseurs sont face à leur attaquant. L'un d'eux a le ballon.
1. Le défenseur qui a le ballon l'envoie à son attaquant et fait un close-out.
2. L'attaquant a 3 dribbles pour aller marquer. Le défenseur doit le contenir pendant ces 3 dribbles.
3. Une fois ses 3 dribbles faits, l'attaquant s'arrête et passe le ballon à un autre attaquant.
4. Au moment de la passe, le défenseur concerné fait à son tour un close-out.
5. On répète le même schéma jusqu'à ce que tous les attaquants aient attaqué.
## Score
- L'attaque marque : 1 point pour l'attaque.
- La défense contient : 2 points pour la défense.
- Qu'il y ait panier ou non, on continue le schéma.
## Axes techniques
- Tous les close-outs sont contrôlés.
- Le défenseur ferme l'axe.
- Il annonce « balle » très fort.` },
      { key: "u13-table", title: "Quelle variante pour quel objectif", duration: "", items: [], body: `- **Finition sur coupe** : exercice 1, base. Aucun changement.
- **Backdoor** : exercice 1, variante vidéo. 2 plots déplacés, passeur vers le corner.
- **Drive de ligne de fond** : exercice 1, variante vidéo. Le joueur du corner drive au lieu du backdoor.
- **Dribble et changements de rythme** : exercice 2. 3 plots en slalom, 1 dribble maximum pour finir.
- **Jeu de jambes puis jump shoot** : exercice 2, carrés de plots. Un carré pour chaque rôle.
- **Tir en catch and shoot** : exercice 3. La finition devient un tir.
- **Passe et coupe** : exercice 3, variante. Passe à l'aile, coupe, tirs alternant gauche et droite.
- **Passes** : exercice 4. Seconde passe, 2 joueurs à l'aile.
- **Défense de la pénétration** : exercice 5. Un défenseur, pied dans la raquette avant la passe.
- **Tirs contestés** : exercice 5, variante tir. Close-out du défenseur.
- **Physique et course** : exercice 6. Plots espacés, joueur sur la touche.
- **Défense : close-outs** : exercice 7. 4 défenseurs aux coins de la raquette, 4 attaquants.` },
    ],
  };
})();
