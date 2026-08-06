# Plan d'interface

## Référence préservée — Practice / Long Run

Cette note conserve les contraintes de l'interface validée avant l'ajustement mobile du 6 août 2026.

- La vue bureau reste composée de la carte de jeu à gauche et du panneau Long Run à droite.
- Le carré coloré, la jauge et les boutons de notes gardent leur comportement, leurs couleurs et leurs retours visuels.
- Les sélecteurs du nombre de notes et du type d'expérience restent au-dessus de la zone de jeu.
- Le panneau Long Run conserve le niveau débloqué, la progression, le niveau en cours, le délai, le score, les vies, le record et les règles.
- Le comportement métier et la vue bureau du mode Contre-la-montre restent préservés ; seule sa présentation mobile reprend le tableau de bord compact décrit ci-dessous.

## Ajustement mobile ciblé

Sous 600 px, Long Run affiche le score, le niveau, les vies et le record dans la carte de jeu et masque leurs doublons dans le panneau inférieur. En mode une note, ces informations sont centrées dans la place à gauche du carré coloré et les boutons restent à droite. Le carré est légèrement réduit pour que les trois zones tiennent sur la largeur d'un téléphone. Pour les groupes de trois ou cinq notes, le même tableau de bord reste dans la carte, sur une ligne compacte au-dessus des cartes.

L'objectif est de rendre les informations essentielles visibles pendant la partie sans faire défiler jusqu'au panneau situé sous le jeu.

Le contre-la-montre reprend la même disposition mobile pour son score et son record, placés à gauche du carré et sans doublon dans le panneau inférieur. Long Run ajoute également le record à son tableau de bord. Le haut de ces informations est aligné avec le haut du carré coloré.

Dans les formats de trois et cinq notes, l'ordre visuel des cartes est aléatoire et ne doit pas être trié du grave vers l'aigu. Cet ordre représente une ligne mélodique à lire ; il reste indépendant de l'ordre dans lequel l'utilisateur sélectionne les noms de notes.
