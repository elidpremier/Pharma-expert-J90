# Système de Minuteur pour les Sessions Quotidiennes

## Vue d'ensemble

Le système de minuteur permet de suivre précisément le temps de chaque bloc de la routine journalière. Chaque session a sa propre durée prédéfinie et peut être gérée indépendamment.

## Fonctionnalités Principales

### 1. Minuteur par Session

Chaque bloc horaire dispose d'un minuteur dédié avec les durées suivantes :

| Bloc | Durée | Heure |
|------|-------|-------|
| Réveil & Hydratation | 15 min | 06:00-06:15 |
| Prélecture Scientifique | 30 min | 06:15-06:45 |
| Révision J-1 | 30 min | 06:45-07:15 |
| Préparation Université | 25 min | 07:15-07:40 |
| Cours Master | 300 min (5h) | 08:00-13:00 |
| Bloc Principal : Apprentissage | 90 min | 14:30-16:00 |
| Pause Repos | 30 min | 16:00-16:30 |
| Approfondissement Scientifique | 60 min | 16:30-17:30 |
| Analyse de Données : R | 60 min | 20:00-21:00 |
| Organisation & Planification | 20 min | 21:00-21:20 |

### 2. Contrôles du Minuteur

Pour chaque session, trois contrôles sont disponibles :

- **Bouton Minuteur** : Lance le minuteur pour la session (affiche "Minuteur" avec icône play)
- **Bouton Pause** : Met le minuteur en pause (affiche icône pause)
- **Bouton Stop** : Arrête complètement le minuteur (affiche icône stop)

### 3. Affichage du Minuteur

Lorsqu'un minuteur est actif :

- Le temps restant s'affiche en format **MM:SS** (minutes:secondes)
- La durée totale de la session est affichée en dessous
- La carte de la session est mise en évidence avec un **anneau vert** (ring-2 ring-green-400)
- Le minuteur se met à jour chaque seconde en temps réel

### 4. Notifications et Récompenses

**À la fin d'une session :**

- Notification système (si autorisée)
- Notification sonore (bip)
- Message de notification dans l'application
- **+15 XP** accordés automatiquement
- Mise à jour de l'interface utilisateur

### 5. Gestion de l'Écran

Le système utilise l'**API Screen Wake Lock** pour :

- Maintenir l'écran actif pendant une session
- Éviter que le téléphone/ordinateur ne se mette en veille
- Libérer le verrou lorsque la session est terminée ou mise en pause

## Utilisation

### Démarrer une Session

1. Cliquez sur le bouton **"Minuteur"** du bloc horaire
2. Le minuteur démarre automatiquement
3. L'écran reste actif pendant la session

### Mettre en Pause

1. Cliquez sur le bouton **"Pause"** (icône pause)
2. Le minuteur s'arrête mais le temps restant est conservé
3. Cliquez à nouveau pour reprendre

### Arrêter une Session

1. Cliquez sur le bouton **"Stop"** (icône stop)
2. Le minuteur s'arrête et réinitialise
3. Vous pouvez relancer une nouvelle session

### Marquer une Tâche comme Complétée

1. Cliquez sur le **cercle blanc** à gauche de la session
2. La tâche est marquée comme complétée (cercle vert avec checkmark)
3. **+10 XP** sont accordés

## Architecture Technique

### Variables d'État

```javascript
// Minuteur actif actuellement
let activeSessionTimer = {
    taskIndex,      // Index du bloc
    timeLeft,       // Temps restant en secondes
    endTime,        // Timestamp de fin
    interval        // ID de l'intervalle
};

// Historique des minuteurs
let sessionTimers = {
    taskIndex: {
        totalTime,    // Durée totale
        elapsedTime,  // Temps écoulé
        isRunning     // État d'exécution
    }
};
```

### Fonctions Principales

- **`startSessionTimer(taskIndex)`** : Démarre un minuteur pour une session
- **`pauseSessionTimer()`** : Met en pause le minuteur actif
- **`stopSessionTimer()`** : Arrête complètement le minuteur
- **`completeSessionTimer(taskIndex)`** : Finalise une session (appelé automatiquement)
- **`updateSessionTimerDisplay(taskIndex)`** : Met à jour l'affichage du minuteur
- **`getSessionTimerStatus(taskIndex)`** : Récupère l'état d'un minuteur

## Intégration avec le Système de Progression

### XP et Récompenses

- **Démarrage d'une session** : Notification de confirmation
- **Fin d'une session** : +15 XP + notification système + son
- **Tâche complétée** : +10 XP supplémentaires

### Persistance des Données

Les données des sessions sont sauvegardées automatiquement dans `localStorage` via la fonction `saveData()`.

## Cas d'Usage

### Cas 1 : Session Complète

1. Cliquez sur "Minuteur" pour "Prélecture Scientifique" (30 min)
2. Le minuteur compte de 30:00 à 00:00
3. À 00:00, une notification s'affiche : "Session terminée : Prélecture Scientifique ! +15 XP"
4. L'écran se déverrouille automatiquement
5. Vous pouvez marquer la tâche comme complétée

### Cas 2 : Session Interrompue

1. Vous lancez "Cours Master" (300 min)
2. Après 45 minutes, vous cliquez sur "Pause"
3. Le minuteur affiche 4:15 (4h 15 min restantes)
4. Plus tard, vous cliquez sur "Pause" à nouveau pour reprendre
5. Le minuteur continue à partir de 4:15

### Cas 3 : Changement de Session

1. Vous lancez "Réveil & Hydratation" (15 min)
2. Vous changez d'avis et cliquez sur "Minuteur" pour "Prélecture Scientifique"
3. Le minuteur précédent s'arrête automatiquement
4. Le nouveau minuteur démarre (30 min)

## Conseils d'Utilisation

1. **Utilisez le minuteur pour chaque bloc** : Cela vous aide à respecter les horaires
2. **Mettez en pause si nécessaire** : Le système conserve le temps restant
3. **Vérifiez les notifications** : Assurez-vous que les notifications sont activées
4. **Profitez des récompenses XP** : Les sessions complétées vous rapprochent du prochain niveau

## Limitations et Notes

- Un seul minuteur peut être actif à la fois
- Le minuteur utilise le temps système (pas de synchronisation réseau)
- L'API Screen Wake Lock peut ne pas fonctionner sur tous les navigateurs
- Les données sont stockées localement (pas de synchronisation cloud)

## Améliorations Futures

- [ ] Minuteurs multiples simultanés
- [ ] Historique détaillé des sessions
- [ ] Statistiques de temps par bloc
- [ ] Rappels avant la fin d'une session
- [ ] Synchronisation cloud des données
- [ ] Intégration avec les calendriers externes

---

**Version** : 1.0  
**Dernière mise à jour** : 2026-03-08
