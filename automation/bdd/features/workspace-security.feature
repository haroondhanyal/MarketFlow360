Feature: MarketFlow360 workspace navigation and public pages
  As a workspace owner
  I want workspace-specific pages to load safely
  So that tenant records stay isolated

  Scenario Outline: team access screen loads for a workspace
    Given I selected test workspace "<workspace>"
    When I open the "Team" screen
    Then a primary heading is displayed
    Examples:
      | workspace |
      | W1 |
      | W2 |
      | W3 |
      | W4 |
      | W5 |

  Scenario Outline: pipeline page loads for a workspace
    Given I selected test workspace "<workspace>"
    When I open the "Leads" screen
    Then a primary heading is displayed
    Examples:
      | workspace |
      | W1 |
      | W2 |
      | W3 |
      | W4 |
      | W5 |

  Scenario Outline: workspace dashboard route is reachable
    Given I selected test workspace "<workspace>"
    When I open the "Overview" screen
    Then a primary heading is displayed
    Examples:
      | workspace |
      | W1 |
      | W2 |
      | W3 |
      | W4 |
      | W5 |

  Scenario Outline: public enquiry form is available
    Given I selected test workspace "<workspace>"
    When I open the "Public form" screen
    Then a primary heading is displayed
    Examples:
      | workspace |
      | W1 |
      | W2 |
      | W3 |
      | W4 |
      | W5 |

  Scenario Outline: customer follow-up screen is reachable
    Given I selected test workspace "<workspace>"
    When I open the "Tasks" screen
    Then a primary heading is displayed
    Examples:
      | workspace |
      | W1 |
      | W2 |
      | W3 |
      | W4 |
      | W5 |
