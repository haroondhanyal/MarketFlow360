Feature: MarketFlow360 marketing workflows
  As a marketing manager
  I want to open marketing tools in the selected workspace
  So that campaign operations stay organized

  Scenario Outline: campaigns screen loads for a workspace
    Given I selected test workspace "<workspace>"
    When I open the "Campaigns" screen
    Then a primary heading is displayed
    Examples:
      | workspace |
      | W1 |
      | W2 |
      | W3 |
      | W4 |
      | W5 |

  Scenario Outline: content calendar loads for a workspace
    Given I selected test workspace "<workspace>"
    When I open the "Content" screen
    Then a primary heading is displayed
    Examples:
      | workspace |
      | W1 |
      | W2 |
      | W3 |
      | W4 |
      | W5 |

  Scenario Outline: landing pages load for a workspace
    Given I selected test workspace "<workspace>"
    When I open the "Landing pages" screen
    Then a primary heading is displayed
    Examples:
      | workspace |
      | W1 |
      | W2 |
      | W3 |
      | W4 |
      | W5 |

  Scenario Outline: automation screen loads for a workspace
    Given I selected test workspace "<workspace>"
    When I open the "Automations" screen
    Then a primary heading is displayed
    Examples:
      | workspace |
      | W1 |
      | W2 |
      | W3 |
      | W4 |
      | W5 |

  Scenario Outline: integration screen loads for a workspace
    Given I selected test workspace "<workspace>"
    When I open the "Integrations" screen
    Then a primary heading is displayed
    Examples:
      | workspace |
      | W1 |
      | W2 |
      | W3 |
      | W4 |
      | W5 |
