export interface MobileSpec {
  screens: string[]
  navPattern: 'tabs' | 'stack' | 'drawer'
  platform: 'ios' | 'android' | 'universal'
  colorMode: 'dark' | 'light'
  primaryColor: string
  accentColor: string
  stylingLib: 'nativewind' | 'tamagui'
  gestures: string[]
  components: string[]
}

export interface ComponentTreeNode {
  screen: string
  components: string[]
  canvasX: number
  canvasY: number
}