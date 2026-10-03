Feature: MarketFlow360 insights and account settings
  As a team owner
  I want to review analytics and manage my workspace account
  So that I can take informed next steps

  Scenario Outline: assistant screen loads for a workspace
    Given I selected test workspace "<workspace>"
    When I open the "Assistant" screen
    Then a primary heading is displayed
    Examples:
      | workspace |
      | W1 |
      | W2 |
      | W3 |
      | W4 |
      | W5 |

  Scenario Outline: reports screen loads for a workspace
    Given I selected test workspace "<workspace>"
    When I open the "Reports" screen
    Then a primary heading is displayed
    Examples:
      | workspace |
      | W1 |
      | W2 |
      | W3 |
      | W4 |
      | W5 |

  Scenario Outline: audit log loads for a workspace
    Given I selected test workspace "<workspace>"
    When I open the "Audit" screen
    Then a primary heading is displayed
    Examples:
      | workspace |
      | W1 |
      | W2 |
      | W3 |
      | W4 |
      | W5 |

  Scenario Outline: plans screen loads for a workspace
    Given I selected test workspace "<workspace>"
    When I open the "Plans" screen
    Then a primary heading is displayed
    Examples:
      | workspace |
      | W1 |
      | W2 |
      | W3 |
      | W4 |
      | W5 |

  Scenario Outline: account profile loads for a workspace
    Given I selected test workspace "<workspace>"
    When I open the "Profile" screen
    Then a primary heading is displayed
    Examples:
      | workspace |
      | W1 |
      | W2 |
      | W3 |
      | W4 |
      | W5 |
