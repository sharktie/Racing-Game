export default class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }


create() {
    this.add.text(400, 300, 'Racing Game', { fontSize: '48px', fill: '#fff' }).setOrigin(0.5);
    this.add.text(400, 400, 'Press SPACE to Start', { fontSize: '24px', fill: '#fff' }).setOrigin(0.5); 


}

}